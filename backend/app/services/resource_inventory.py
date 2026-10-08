from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status
from app.repository.resource_inventory import ResourceInventoryRepository
from app.repository.resource_activity_log import ResourceActivityLogRepository
from app.repository.access_control import UserPermissionRepository
from app.schemas.resource_inventory import ResourceInventoryUpdate
from app.redis.service import get_cache, set_cache, delete_cache, clear_pattern, make_list_key

class ResourceInventoryService:

    @staticmethod
    async def check_user_permission(current_user: dict, action: str) -> bool:
        """
        Validates if current_user has access to perform `action` ('read', 'create', 'edit', 'delete')
        on the Resource Inventory module.
        """
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
                if mod_id in ["/workspace/resource", "/resource", "resource", "resource management"]:
                    if action == "read" and mod.get("read"):
                        return True
                    if action == "create" and (mod.get("create") or mod.get("add")):
                        return True
                    if action in ["edit", "update"] and (mod.get("edit") or mod.get("update")):
                        return True
                    if action == "delete" and mod.get("delete"):
                        return True

        # Default fallback: logged in employees can view/read, but edit/delete requires explicit permission
        if action == "read":
            return True

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied: You do not have '{action}' permission for Resource Inventory."
        )

    @staticmethod
    async def get_all_inventory(
        current_user: dict,
        category_id: Optional[str] = None,
        status: Optional[str] = None,
        condition: Optional[str] = None,
        assigned_to_employee_id: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        limit: int = 10
    ) -> Dict[str, Any]:
        await ResourceInventoryService.check_user_permission(current_user, "read")

        work = current_user.get("work_details", {}) or {}
        role = str(work.get("system_role") or current_user.get("system_role", "Employee")).strip().lower()

        # Regular Employees can ONLY view resources allocated to them
        if role not in ["admin", "ceo", "hr", "hr manager", "subadmin"]:
            emp_id = str(current_user.get("_id") or current_user.get("id", "")).strip()
            assigned_to_employee_id = emp_id

        cache_key = make_list_key(
            "resource_inventory:list",
            user_id=str(current_user.get("_id")),
            category_id=category_id,
            status=status,
            condition=condition,
            assigned_to_employee_id=assigned_to_employee_id,
            search=search,
            page=page,
            limit=limit
        )
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        res = await ResourceInventoryRepository.get_all(
            is_deleted=False,
            category_id=category_id,
            status=status,
            condition=condition,
            assigned_to_employee_id=assigned_to_employee_id,
            search=search,
            page=page,
            limit=limit
        )
        await set_cache(cache_key, res, ttl=1800)
        return res

    @staticmethod
    async def get_my_resources(
        current_user: dict,
        search: Optional[str] = None,
        page: int = 1,
        limit: int = 10
    ) -> Dict[str, Any]:
        emp_id = str(current_user.get("_id") or current_user.get("id", "")).strip()
        return await ResourceInventoryRepository.get_all(
            is_deleted=False,
            assigned_to_employee_id=emp_id,
            search=search,
            page=page,
            limit=limit
        )

    @staticmethod
    async def get_by_id(item_id: str, current_user: dict) -> Optional[Dict[str, Any]]:
        await ResourceInventoryService.check_user_permission(current_user, "read")

        item = await ResourceInventoryRepository.get_by_id(item_id)
        if not item or item.get("is_deleted"):
            return None

        work = current_user.get("work_details", {}) or {}
        role = str(work.get("system_role") or current_user.get("system_role", "Employee")).strip().lower()

        # Regular employee check: item must be assigned to them
        if role not in ["admin", "ceo", "hr", "hr manager", "subadmin"]:
            emp_id = str(current_user.get("_id") or current_user.get("id", "")).strip()
            assigned = item.get("assigned_to") or {}
            assigned_emp_id = str(assigned.get("employee_id", "")).strip()
            if assigned_emp_id != emp_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You can only view resources allocated to you."
                )

        return item

    @staticmethod
    async def update_inventory_item(item_id: str, data: ResourceInventoryUpdate, current_user: dict) -> Optional[Dict[str, Any]]:
        await ResourceInventoryService.check_user_permission(current_user, "edit")

        item = await ResourceInventoryRepository.get_by_id(item_id)
        if not item or item.get("is_deleted"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory item not found")

        update_dict = data.model_dump(exclude_unset=True)
        success = await ResourceInventoryRepository.update(item_id, update_dict)
        if success:
            updated_item = await ResourceInventoryRepository.get_by_id(item_id)
            res_code = (updated_item or item).get("resource_id") or item_id
            cat_id = (updated_item or item).get("category_id")

            # Log Assignment change
            old_assigned = item.get("assigned_to")
            new_assigned = (updated_item or {}).get("assigned_to")
            if old_assigned != new_assigned:
                if new_assigned and isinstance(new_assigned, dict):
                    emp_name = new_assigned.get("employee_name") or "Employee"
                    act = "Resource Allocated"
                    dt = f"Assigned item '{res_code}' to {emp_name}."
                else:
                    act = "Resource Unassigned"
                    dt = f"Unassigned item '{res_code}'."

                await ResourceActivityLogRepository.log_activity("resource", item_id, act, dt, current_user)
                if res_code != item_id:
                    await ResourceActivityLogRepository.log_activity("resource", res_code, act, dt, current_user)
                if cat_id:
                    await ResourceActivityLogRepository.log_activity("category", cat_id, act, dt, current_user)

            # Log Status change
            if item.get("status") != (updated_item or {}).get("status"):
                dt = f"Status of item '{res_code}' changed from '{item.get('status')}' to '{(updated_item or {}).get('status')}'."
                await ResourceActivityLogRepository.log_activity("resource", item_id, "Status Updated", dt, current_user)
                if res_code != item_id:
                    await ResourceActivityLogRepository.log_activity("resource", res_code, "Status Updated", dt, current_user)
                if cat_id:
                    await ResourceActivityLogRepository.log_activity("category", cat_id, "Status Updated", dt, current_user)

            # Log Condition change
            if item.get("condition") != (updated_item or {}).get("condition"):
                dt = f"Condition of item '{res_code}' updated from '{item.get('condition')}' to '{(updated_item or {}).get('condition')}'."
                await ResourceActivityLogRepository.log_activity("resource", item_id, "Condition Updated", dt, current_user)
                if res_code != item_id:
                    await ResourceActivityLogRepository.log_activity("resource", res_code, "Condition Updated", dt, current_user)

            await clear_pattern("resource_inventory:*")
            await delete_cache(f"resource_inventory_item:{item_id}")
        return await ResourceInventoryRepository.get_by_id(item_id)

    @staticmethod
    async def delete_inventory_item(item_id: str, current_user: dict) -> bool:
        from app.database.db import get_database
        from bson import ObjectId
        from datetime import datetime

        await ResourceInventoryService.check_user_permission(current_user, "delete")

        item = await ResourceInventoryRepository.get_by_id(item_id)
        if not item or item.get("is_deleted"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory item not found")

        cat_id = item.get("category_id")
        cat_name = item.get("category_name")
        res_code = item.get("resource_id") or item_id

        success = await ResourceInventoryRepository.delete(item_id)
        if success:
            dt = f"Deleted inventory item '{res_code}' from category '{cat_name}'."
            await ResourceActivityLogRepository.log_activity("resource", item_id, "Item Deleted", dt, current_user)
            if res_code != item_id:
                await ResourceActivityLogRepository.log_activity("resource", res_code, "Item Deleted", dt, current_user)
            if cat_id:
                await ResourceActivityLogRepository.log_activity("category", cat_id, "Item Deleted", dt, current_user)

            if cat_id or cat_name:
                cat_db = get_database()["resource_categories"]
                query = {}
                if cat_id and ObjectId.is_valid(str(cat_id)):
                    query["_id"] = ObjectId(str(cat_id))
                elif cat_name:
                    query["category_name"] = cat_name

                if query:
                    await cat_db.update_one(
                        query,
                        {
                            "$inc": {"total_resources": -1, "total_items": -1},
                            "$set": {"updated_at": datetime.utcnow()}
                        }
                    )

            await clear_pattern("resource_inventory:*")
            await clear_pattern("resource_categories:*")
            await delete_cache(f"resource_inventory_item:{item_id}")
            if cat_id:
                await delete_cache(f"resource_category:{cat_id}")
        return success

    @staticmethod
    async def get_dashboard(current_user: dict) -> Dict[str, Any]:
        await ResourceInventoryService.check_user_permission(current_user, "read")

        cache_key = "resource_inventory:dashboard"
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        data = await ResourceInventoryRepository.get_dashboard_analytics()
        await set_cache(cache_key, data, ttl=300)
        return data
