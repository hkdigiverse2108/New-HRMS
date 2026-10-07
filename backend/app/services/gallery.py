from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status
from app.repository.gallery import GalleryEventRepository
from app.repository.access_control import UserPermissionRepository
from app.schemas.gallery import GalleryEventCreate, GalleryEventUpdate
from app.redis.service import get_cache, set_cache, delete_cache, clear_pattern, make_list_key
from app.utils.google_drive import auto_extract_gallery_images, auto_extract_gallery_media, extract_drive_file_id, is_video_filename

class GalleryService:

    @staticmethod
    def _backfill_item_media(item: Dict[str, Any]) -> Dict[str, Any]:
        if not item:
            return item
        media_items = item.get("media_items")
        images = item.get("images", [])
        link = item.get("link")

        needs_backfill = (
            not media_items
            or not isinstance(media_items, list)
            or any(
                not isinstance(m, dict) or not m.get("media_type")
                for m in (media_items or [])
            )
        )

        if needs_backfill:
            new_images, new_media = auto_extract_gallery_media(link, images, None)
            item["images"] = new_images
            item["media_items"] = new_media
        return item

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

        # Auto extract structured media_items & images from Drive link
        link_val = data_dict.get("link")
        existing_imgs = data_dict.get("images", [])
        existing_media = data_dict.get("media_items", [])

        imgs, media = auto_extract_gallery_media(link_val, existing_imgs, existing_media)
        data_dict["images"] = imgs
        data_dict["media_items"] = media

        created = await GalleryEventRepository.create(data_dict)
        await clear_pattern("gallery_events:*")
        return created

    @staticmethod
    async def get_all_events(
        current_user: dict,
        search: Optional[str] = None,
        date: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        page: int = 1,
        limit: int = 10
    ) -> Dict[str, Any]:
        await GalleryService.check_user_permission(current_user, "read")

        cache_key = make_list_key(
            "gallery_events:list",
            search=search,
            date=date,
            start_date=start_date,
            end_date=end_date,
            page=page,
            limit=limit
        )
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        res = await GalleryEventRepository.get_all(
            is_deleted=False,
            search=search,
            date=date,
            start_date=start_date,
            end_date=end_date,
            page=page,
            limit=limit
        )
        
        # Backfill media_items for existing items in response
        if res and "items" in res:
            res["items"] = [GalleryService._backfill_item_media(item) for item in res["items"]]
        if res and "data" in res:
            res["data"] = [GalleryService._backfill_item_media(item) for item in res["data"]]

        await set_cache(cache_key, res, ttl=1800)
        return res

    @staticmethod
    async def get_by_id(item_id: str, current_user: dict) -> Optional[Dict[str, Any]]:
        await GalleryService.check_user_permission(current_user, "read")

        cache_key = f"gallery_event:{item_id}"
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        item = await GalleryEventRepository.get_by_id(item_id)
        if item and not item.get("is_deleted"):
            item = GalleryService._backfill_item_media(item)
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

        new_link = update_dict.get("link", item.get("link"))
        old_link = item.get("link")

        if "link" in update_dict and update_dict["link"] != old_link:
            new_images = None
            new_media = None
        else:
            new_images = update_dict.get("images", item.get("images", []))
            new_media = update_dict.get("media_items", item.get("media_items", []))

        imgs, media = auto_extract_gallery_media(new_link, new_images, new_media)
        update_dict["images"] = imgs
        update_dict["media_items"] = media

        success = await GalleryEventRepository.update(item_id, update_dict)
        if success:
            await clear_pattern("gallery_events:*")
            await delete_cache(f"gallery_event:{item_id}")
        
        updated_item = await GalleryEventRepository.get_by_id(item_id)
        return GalleryService._backfill_item_media(updated_item) if updated_item else None

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
