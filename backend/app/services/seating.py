from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status
from app.repository.seating import SeatingRepository
from app.repository.employee import EmployeeRepository
from app.repository.access_control import UserPermissionRepository
from app.schemas.seating import FloorCreate, FloorUpdate, DeskCreateOrUpdate, SeatAllocateRequest
from app.redis.service import get_cache, set_cache, delete_cache, clear_pattern

class SeatingService:

    @staticmethod
    async def check_user_permission(current_user: dict, action: str) -> bool:
        if not current_user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

        work = current_user.get("work_details", {}) or {}
        role = str(work.get("system_role") or current_user.get("system_role", "Employee")).strip().lower()

        # Admin, CEO, HR, SubAdmin roles have full access by default
        if role in ["admin", "ceo", "hr", "hr manager", "subadmin"]:
            return True

        emp_id = str(current_user.get("_id") or current_user.get("id", "")).strip()

        # Check manual/custom permissions for this employee
        user_perm = await UserPermissionRepository.get_user_permission(emp_id)
        if user_perm and user_perm.get("module_permissions"):
            mod_perms = user_perm.get("module_permissions", [])
            for mod in mod_perms:
                mod_id = str(mod.get("module_id", "")).lower()
                if mod_id in ["/workspace/seating", "/seating", "seating", "seating arrangement"]:
                    if action == "read" and mod.get("read"):
                        return True
                    if action == "create" and (mod.get("create") or mod.get("add")):
                        return True
                    if action in ["edit", "update"] and (mod.get("edit") or mod.get("update")):
                        return True
                    if action == "delete" and mod.get("delete"):
                        return True

        # Default fallback: logged in employees can view/read layout, but editing requires permission
        if action == "read":
            return True

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied: You do not have '{action}' permission for Seating Arrangement."
        )

    @staticmethod
    async def create_floor(data: FloorCreate, current_user: dict) -> Dict[str, Any]:
        await SeatingService.check_user_permission(current_user, "create")

        creator_name = current_user.get("contact_info", {}).get("full_name") or current_user.get("full_name") or "Admin"
        work = current_user.get("work_details", {}) or {}
        user_role = str(work.get("system_role") or current_user.get("system_role", "Admin")).strip()

        data_dict = data.model_dump(exclude_unset=True)
        data_dict["created_by"] = {
            "user_id": str(current_user.get("_id", "")),
            "name": creator_name,
            "role": user_role
        }

        created = await SeatingRepository.create_floor(data_dict)
        await clear_pattern("seating:*")
        return created

    @staticmethod
    async def get_all_floors(current_user: dict) -> List[Dict[str, Any]]:
        await SeatingService.check_user_permission(current_user, "read")

        cache_key = "seating:floors:all"
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        floors = await SeatingRepository.get_all_floors(is_deleted=False)
        await set_cache(cache_key, floors, ttl=900)
        return floors

    @staticmethod
    async def get_floor_by_id(floor_id: str, current_user: dict) -> Optional[Dict[str, Any]]:
        await SeatingService.check_user_permission(current_user, "read")

        cache_key = f"seating:floor:{floor_id}"
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        floor = await SeatingRepository.get_floor_by_id(floor_id)
        if not floor:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Floor layout not found")

        await set_cache(cache_key, floor, ttl=900)
        return floor

    @staticmethod
    async def update_floor(floor_id: str, data: FloorUpdate, current_user: dict) -> Optional[Dict[str, Any]]:
        await SeatingService.check_user_permission(current_user, "edit")

        floor = await SeatingRepository.get_floor_by_id(floor_id)
        if not floor:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Floor layout not found")

        success = await SeatingRepository.update_floor(floor_id, data.model_dump(exclude_unset=True))
        if success:
            await clear_pattern("seating:*")
        return await SeatingRepository.get_floor_by_id(floor_id)

    @staticmethod
    async def delete_floor(floor_id: str, current_user: dict) -> bool:
        await SeatingService.check_user_permission(current_user, "delete")

        floor = await SeatingRepository.get_floor_by_id(floor_id)
        if not floor:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Floor layout not found")

        success = await SeatingRepository.delete_floor(floor_id)
        if success:
            await clear_pattern("seating:*")
        return success

    @staticmethod
    async def save_desk(floor_id: str, data: DeskCreateOrUpdate, current_user: dict) -> Dict[str, Any]:
        await SeatingService.check_user_permission(current_user, "edit")

        floor = await SeatingRepository.get_floor_by_id(floor_id)
        if not floor:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Floor layout not found")

        desk_data = data.model_dump(exclude_unset=True)
        updated_desk = await SeatingRepository.save_desk(floor_id, desk_data)
        if not updated_desk:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to save desk configuration")

        await clear_pattern("seating:*")
        return updated_desk

    @staticmethod
    async def delete_desk(floor_id: str, desk_id: str, current_user: dict) -> bool:
        await SeatingService.check_user_permission(current_user, "delete")

        floor = await SeatingRepository.get_floor_by_id(floor_id)
        if not floor:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Floor layout not found")

        success = await SeatingRepository.delete_desk(floor_id, desk_id)
        if success:
            await clear_pattern("seating:*")
        return success

    @staticmethod
    async def allocate_seat(
        floor_id: str,
        desk_id: str,
        seat_id: str,
        data: SeatAllocateRequest,
        current_user: dict
    ) -> Dict[str, Any]:
        await SeatingService.check_user_permission(current_user, "edit")

        floor = await SeatingRepository.get_floor_by_id(floor_id)
        if not floor:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Floor layout not found")

        emp_info = None
        status_val = data.status.strip() if data.status else "Available"

        if data.employee_id and status_val.lower() == "allocated":
            emp = await EmployeeRepository.get_employee_by_id(data.employee_id)
            if not emp:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Selected employee not found")
            
            p_info = emp.get("personal_info", {}) or {}
            w_info = emp.get("work_details", {}) or {}
            first_name = p_info.get("first_name") or emp.get("first_name", "")
            last_name = p_info.get("last_name") or emp.get("last_name", "")

            emp_info = {
                "employee_id": str(emp.get("_id") or emp.get("employee_id")),
                "first_name": first_name,
                "last_name": last_name,
                "email": p_info.get("email_address") or emp.get("email", ""),
                "department": w_info.get("department") or ""
            }
        else:
            status_val = "Available"

        success = await SeatingRepository.allocate_seat(
            floor_id=floor_id,
            desk_id=desk_id,
            seat_id=seat_id,
            status=status_val,
            employee_info=emp_info
        )

        if not success:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update seat allocation")

        await clear_pattern("seating:*")
        updated_floor = await SeatingRepository.get_floor_by_id(floor_id)
        return updated_floor
