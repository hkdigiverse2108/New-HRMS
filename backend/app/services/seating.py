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
        if role in ["admin", "ceo", "hr", "hr manager", "subadmin", "sub admin", "sub_admin"]:
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
        floor_id: Optional[str],
        desk_id: Optional[str],
        seat_id: Optional[str],
        data: SeatAllocateRequest,
        current_user: dict
    ) -> Dict[str, Any]:
        await SeatingService.check_user_permission(current_user, "edit")

        effective_desk_id = desk_id or data.desk_id
        effective_seat_id = seat_id or data.seat_id

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

            desig = w_info.get("designation") or w_info.get("job_title") or emp.get("designation", "")
            prof_pic = p_info.get("profile_picture") or emp.get("profile_picture", "")

            emp_info = {
                "employee_id": str(emp.get("_id") or emp.get("employee_id")),
                "first_name": first_name,
                "last_name": last_name,
                "email": p_info.get("email_address") or emp.get("email", ""),
                "department": w_info.get("department") or "",
                "designation": desig,
                "profile_picture": prof_pic
            }
        else:
            status_val = "Available"

        # Validation: Check if seat is already allocated to another employee
        check_floor_id = floor_id
        if not check_floor_id and effective_desk_id:
            f_doc = await SeatingRepository.find_floor_by_desk_id(effective_desk_id)
            if f_doc:
                check_floor_id = f_doc["_id"]

        if check_floor_id:
            current_floor = await SeatingRepository.get_floor_by_id(check_floor_id)
            if current_floor:
                for d in current_floor.get("desks", []):
                    if not effective_desk_id or d.get("desk_id") == effective_desk_id:
                        for s in d.get("seats", []):
                            if not effective_seat_id or s.get("seat_id") == effective_seat_id:
                                if status_val == "Allocated" and s.get("status") == "Allocated" and s.get("assigned_to"):
                                    curr_emp = s.get("assigned_to", {})
                                    curr_emp_id = str(curr_emp.get("employee_id", ""))
                                    target_emp_id = str(data.employee_id or "")
                                    if curr_emp_id and curr_emp_id != target_emp_id:
                                        curr_name = curr_emp.get("full_name") or curr_emp_id
                                        raise HTTPException(
                                            status_code=status.HTTP_400_BAD_REQUEST,
                                            detail=f"Seat '{effective_seat_id}' is already allocated to employee '{curr_name}'. It must be set to 'Available' (unassigned) first before allocating to another employee."
                                        )

        target_floor_id = await SeatingRepository.allocate_seat(
            floor_id=floor_id,
            desk_id=effective_desk_id,
            seat_id=effective_seat_id,
            status=status_val,
            employee_info=emp_info
        )

        if not target_floor_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update seat allocation. Ensure valid floor or desk ID.")

        await clear_pattern("seating:*")
        updated_floor = await SeatingRepository.get_floor_by_id(target_floor_id)
        if not updated_floor:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Floor layout not found")

        target_desk = None
        for d in updated_floor.get("desks", []):
            if effective_desk_id and d.get("desk_id") == effective_desk_id:
                target_desk = d
                break
            if effective_seat_id:
                for s in d.get("seats", []):
                    if s.get("seat_id") == effective_seat_id:
                        target_desk = d
                        break
            if target_desk:
                break

        if not target_desk and updated_floor.get("desks"):
            target_desk = updated_floor["desks"][0]

        res_desk = dict(target_desk) if target_desk else {}
        res_desk["floor_id"] = updated_floor.get("_id")
        res_desk["floor_name"] = updated_floor.get("floor_name")

        return res_desk

    @staticmethod
    async def get_my_seat(current_user: dict) -> Dict[str, Any]:
        """Allows any employee to view their own allocated seat, desk details, and allocated inventory resources."""
        if not current_user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

        emp_id = str(current_user.get("_id") or current_user.get("id", "")).strip()

        floors = await SeatingRepository.get_all_floors(is_deleted=False)
        for floor in floors:
            for desk in floor.get("desks", []):
                for seat in desk.get("seats", []):
                    assigned = seat.get("assigned_to")
                    if assigned and str(assigned.get("employee_id")) == emp_id:
                        return {
                            "floor_id": floor.get("_id"),
                            "floor_name": floor.get("floor_name"),
                            "desk_id": desk.get("desk_id"),
                            "desk_name": desk.get("desk_name"),
                            "seat_id": seat.get("seat_id"),
                            "status": seat.get("status"),
                            "assigned_to": assigned
                        }

        return {
            "message": "No seat is currently allocated to you.",
            "seat_id": None,
            "assigned_to": None
        }

    @staticmethod
    async def get_all_seats(
        status_filter: Optional[str] = None,
        floor_id: Optional[str] = None,
        search: Optional[str] = None,
        current_user: dict = None
    ) -> List[Dict[str, Any]]:
        """Returns a flat list of all seats across all floors/desks with employee and resource details."""
        await SeatingService.check_user_permission(current_user, "read")

        floors = await SeatingRepository.get_all_floors(is_deleted=False)
        all_seats = []

        for floor in floors:
            if floor_id and str(floor.get("_id")) != str(floor_id):
                continue

            for desk in floor.get("desks", []):
                for seat in desk.get("seats", []):
                    st = seat.get("status", "Available")
                    if status_filter and status_filter.lower() != "all":
                        if st.lower() != status_filter.lower():
                            continue

                    assigned = seat.get("assigned_to")

                    if search:
                        q = search.lower().strip()
                        f_name = str(floor.get("floor_name", "")).lower()
                        d_name = str(desk.get("desk_name", "")).lower()
                        s_id = str(seat.get("seat_id", "")).lower()
                        emp_name = str(assigned.get("full_name", "") if assigned else "").lower()
                        emp_dept = str(assigned.get("department", "") if assigned else "").lower()

                        if not (q in f_name or q in d_name or q in s_id or q in emp_name or q in emp_dept):
                            continue

                    seat_item = {
                        "floor_id": floor.get("_id"),
                        "floor_name": floor.get("floor_name"),
                        "desk_id": desk.get("desk_id"),
                        "desk_name": desk.get("desk_name"),
                        "seat_id": seat.get("seat_id"),
                        "status": st,
                        "assigned_to": assigned
                    }
                    all_seats.append(seat_item)

        return all_seats

    @staticmethod
    async def reset_floor_seats(floor_id: Optional[str], current_user: dict) -> Dict[str, Any]:
        """Reset all seats on a specific floor (or all floors if floor_id is None) to Available."""
        await SeatingService.check_user_permission(current_user, "edit")

        if floor_id:
            floor = await SeatingRepository.get_floor_by_id(floor_id)
            if not floor:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Floor layout not found")

        success = await SeatingRepository.reset_floor_seats(floor_id)
        if not success:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to reset floor seats")

        await clear_pattern("seating:*")

        if floor_id:
            updated_floor = await SeatingRepository.get_floor_by_id(floor_id)
            return updated_floor or {"message": "Floor seats reset successfully."}

        return {"message": "All seats across all floors have been reset to Available and cleared successfully."}

    @staticmethod
    async def get_global_layout() -> Dict[str, Any]:
        from app.database.db import get_database
        db = get_database()
        doc = await db["seating_arrangement"].find_one({"_id": "global"})
        if not doc:
            return {"desks": []}
        return {"desks": doc.get("desks", [])}

    @staticmethod
    async def save_global_layout(payload: dict) -> Dict[str, Any]:
        from app.database.db import get_database
        from datetime import datetime
        db = get_database()
        desks = payload.get("desks", [])
        await db["seating_arrangement"].update_one(
            {"_id": "global"},
            {"$set": {"desks": desks, "updated_at": datetime.utcnow()}},
            upsert=True
        )
        return {"status": "success", "desks": desks}

