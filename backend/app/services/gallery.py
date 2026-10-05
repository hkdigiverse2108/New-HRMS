from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status
from app.repository.gallery import GalleryEventRepository
from app.repository.access_control import UserPermissionRepository
from app.schemas.gallery import GalleryEventCreate, GalleryEventUpdate
from app.redis.service import get_cache, set_cache, delete_cache, clear_pattern, make_list_key

class GalleryService:

    @staticmethod
    async def check_user_permission(current_user: dict, action: str) -> bool:
        """
        Validates if current_user has access to perform `action` ('read', 'create', 'edit', 'delete')
        on the Gallery & Events module.
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
                if mod_id in ["/gallery", "/events", "gallery", "events"]:
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
            detail=f"Permission denied: You do not have '{action}' permission for Gallery & Events."
        )

    @staticmethod
    async def create_event(data: GalleryEventCreate, current_user: dict) -> Dict[str, Any]:
        await GalleryService.check_user_permission(current_user, "create")

        data_dict = data.model_dump(exclude_unset=True)

        creator_name = current_user.get("contact_info", {}).get("full_name") or current_user.get("full_name") or "Admin"
        work = current_user.get("work_details", {}) or {}
        user_role = str(work.get("system_role") or current_user.get("system_role", "Admin")).strip()

        data_dict["created_by"] = {
            "user_id": str(current_user.get("_id", "")),
            "name": creator_name,
            "role": user_role
        }

        created = await GalleryEventRepository.create(data_dict)
        await clear_pattern("gallery_events:*")
        return created

    @staticmethod
    async def get_all_events(current_user: dict, search: Optional[str] = None) -> List[Dict[str, Any]]:
        await GalleryService.check_user_permission(current_user, "read")

        cache_key = make_list_key("gallery_events:list", search=search)
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        items = await GalleryEventRepository.get_all(is_deleted=False, search=search)
        await set_cache(cache_key, items, ttl=1800)
        return items

    @staticmethod
    async def get_by_id(item_id: str, current_user: dict) -> Optional[Dict[str, Any]]:
        await GalleryService.check_user_permission(current_user, "read")

        cache_key = f"gallery_event:{item_id}"
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        item = await GalleryEventRepository.get_by_id(item_id)
        if item and not item.get("is_deleted"):
            await set_cache(cache_key, item, ttl=1800)
            return item
        return None

    @staticmethod
    async def update_event(item_id: str, data: GalleryEventUpdate, current_user: dict) -> Optional[Dict[str, Any]]:
        await GalleryService.check_user_permission(current_user, "edit")

        item = await GalleryEventRepository.get_by_id(item_id)
        if not item or item.get("is_deleted"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gallery event not found")

        update_dict = data.model_dump(exclude_unset=True)
        success = await GalleryEventRepository.update(item_id, update_dict)
        if success:
            await clear_pattern("gallery_events:*")
            await delete_cache(f"gallery_event:{item_id}")
        return await GalleryEventRepository.get_by_id(item_id)

    @staticmethod
    async def delete_event(item_id: str, current_user: dict) -> bool:
        await GalleryService.check_user_permission(current_user, "delete")

        item = await GalleryEventRepository.get_by_id(item_id)
        if not item or item.get("is_deleted"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gallery event not found")

        success = await GalleryEventRepository.delete(item_id)
        if success:
            await clear_pattern("gallery_events:*")
            await delete_cache(f"gallery_event:{item_id}")
        return success
