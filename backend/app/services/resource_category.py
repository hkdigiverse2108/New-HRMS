from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status
from app.repository.resource_category import ResourceCategoryRepository
from app.repository.resource_inventory import ResourceInventoryRepository
from app.repository.resource_activity_log import ResourceActivityLogRepository
from app.repository.access_control import UserPermissionRepository
from app.schemas.resource_category import ResourceCategoryCreate, ResourceCategoryUpdate
from app.redis.service import get_cache, set_cache, delete_cache, clear_pattern, make_list_key

class ResourceCategoryService:

    @staticmethod
    async def check_user_permission(current_user: dict, action: str) -> bool:
        """
        Validates if current_user has access to perform `action` ('read', 'create', 'edit', 'delete')
        on the Resource Management module.
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

        # Default fallback: logged in employees can view/read, but create/edit/delete requires explicit permission
        if action == "read":
            return True

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied: You do not have '{action}' permission for Resource Management."
        )

    @staticmethod
    async def create_category(data: ResourceCategoryCreate, current_user: dict) -> Dict[str, Any]:
        await ResourceCategoryService.check_user_permission(current_user, "create")

        data_dict = data.model_dump(exclude_unset=True)

        creator_name = current_user.get("contact_info", {}).get("full_name") or current_user.get("full_name") or "Admin"
        work = current_user.get("work_details", {}) or {}
        user_role = str(work.get("system_role") or current_user.get("system_role", "Admin")).strip()

        data_dict["created_by"] = {
            "user_id": str(current_user.get("_id", "")),
            "name": creator_name,
            "role": user_role
        }

        init_count = int(
            data_dict.get("total_resources") or 
            data_dict.get("initial_resource_count") or 
            data_dict.get("totalItems") or 
            data_dict.get("total_items") or 0
        )
        data_dict["total_resources"] = init_count
        data_dict["total_items"] = init_count

        created = await ResourceCategoryRepository.create(data_dict)
        cat_id = created["_id"]
        cat_name = created["category_name"]

        await ResourceActivityLogRepository.log_activity(
            "category", cat_id, "Category Created",
            f"Created category '{cat_name}' with {init_count} initial resources.", current_user
        )

        # Auto-generate initial inventory items
        if init_count > 0:
            gen_items = await ResourceInventoryRepository.generate_inventory_items(
                category_id=cat_id,
                category_name=cat_name,
                count=init_count,
                created_by=created.get("created_by")
            )
            for g in gen_items:
                await ResourceActivityLogRepository.log_activity(
                    "resource", g["_id"], "Item Created",
                    f"Auto-generated resource '{g.get('resource_id')}' in category '{cat_name}'.", current_user
                )
                if g.get("resource_id") != g.get("_id"):
                    await ResourceActivityLogRepository.log_activity(
                        "resource", g.get("resource_id"), "Item Created",
                        f"Auto-generated resource '{g.get('resource_id')}' in category '{cat_name}'.", current_user
                    )
            await clear_pattern("resource_inventory:*")

        await clear_pattern("resource_categories:*")
        return created

    @staticmethod
    async def get_all_categories(
        current_user: dict,
        search: Optional[str] = None,
        page: int = 1,
        limit: int = 10
    ) -> Dict[str, Any]:
        await ResourceCategoryService.check_user_permission(current_user, "read")

        cache_key = make_list_key("resource_categories:list", search=search, page=page, limit=limit)
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        res = await ResourceCategoryRepository.get_all(is_deleted=False, search=search, page=page, limit=limit)
        await set_cache(cache_key, res, ttl=1800)
        return res

    @staticmethod
    async def get_by_id(item_id: str, current_user: dict) -> Optional[Dict[str, Any]]:
        await ResourceCategoryService.check_user_permission(current_user, "read")

        cache_key = f"resource_category:{item_id}"
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        item = await ResourceCategoryRepository.get_by_id(item_id)
        if item and not item.get("is_deleted"):
            await set_cache(cache_key, item, ttl=1800)
            return item
        return None

    @staticmethod
    async def update_category(item_id: str, data: ResourceCategoryUpdate, current_user: dict) -> Optional[Dict[str, Any]]:
        await ResourceCategoryService.check_user_permission(current_user, "edit")

        item = await ResourceCategoryRepository.get_by_id(item_id)
        if not item or item.get("is_deleted"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource category not found")

        add_cnt = data.add_resources or 0
        rem_cnt = data.remove_resources or 0

        update_dict = data.model_dump(exclude_unset=True)

        success = await ResourceCategoryRepository.update(item_id, update_dict)
        if success:
            cat_name = data.category_name or item.get("category_name", "")
            if data.category_name and data.category_name.strip():
                await ResourceInventoryRepository.update_category_name(item_id, data.category_name.strip())
                await ResourceActivityLogRepository.log_activity(
                    "category", item_id, "Category Renamed",
                    f"Renamed category from '{item.get('category_name')}' to '{data.category_name.strip()}'.", current_user
                )
                await clear_pattern("resource_inventory:*")

            if add_cnt > 0:
                gen_items = await ResourceInventoryRepository.generate_inventory_items(
                    category_id=item_id,
                    category_name=cat_name,
                    count=add_cnt,
                    created_by=item.get("created_by")
                )
                await ResourceActivityLogRepository.log_activity(
                    "category", item_id, "Resources Added",
                    f"Added {add_cnt} new resource item(s) to category '{cat_name}'.", current_user
                )
                for g in gen_items:
                    await ResourceActivityLogRepository.log_activity(
                        "resource", g["_id"], "Item Created",
                        f"Auto-generated resource '{g.get('resource_id')}' in category '{cat_name}'.", current_user
                    )
                    if g.get("resource_id") != g.get("_id"):
                        await ResourceActivityLogRepository.log_activity(
                            "resource", g.get("resource_id"), "Item Created",
                            f"Auto-generated resource '{g.get('resource_id')}' in category '{cat_name}'.", current_user
                        )
                await clear_pattern("resource_inventory:*")

            if rem_cnt > 0:
                removed_count = await ResourceInventoryRepository.remove_inventory_items(
                    category_id=item_id,
                    count=rem_cnt
                )
                await ResourceActivityLogRepository.log_activity(
                    "category", item_id, "Resources Removed",
                    f"Removed {removed_count} resource item(s) from category '{cat_name}'.", current_user
                )
                await clear_pattern("resource_inventory:*")

            await clear_pattern("resource_categories:*")
            await delete_cache(f"resource_category:{item_id}")
        return await ResourceCategoryRepository.get_by_id(item_id)

    @staticmethod
    async def delete_category(item_id: str, current_user: dict) -> bool:
        await ResourceCategoryService.check_user_permission(current_user, "delete")

        item = await ResourceCategoryRepository.get_by_id(item_id)
        if not item or item.get("is_deleted"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource category not found")

        cat_name = item.get("category_name", "Category")
        success = await ResourceCategoryRepository.delete(item_id)
        if success:
            await ResourceInventoryRepository.delete_all_by_category(item_id)
            await ResourceActivityLogRepository.log_activity(
                "category", item_id, "Category Deleted",
                f"Deleted category '{cat_name}' and all associated resources.", current_user
            )
            await clear_pattern("resource_inventory:*")
            await clear_pattern("resource_categories:*")
            await delete_cache(f"resource_category:{item_id}")
        return success
