from typing import List, Dict, Any, Optional
from app.repository.document_type import DocumentTypeRepository
from app.schemas.document_type import DocumentTypeCreate, DocumentTypeUpdate
from app.redis.service import get_cache, set_cache, delete_cache, clear_pattern, make_list_key

class DocumentTypeService:

    @staticmethod
    async def create_document_type(data: DocumentTypeCreate, current_user: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        data_dict = data.model_dump(exclude_unset=True)

        if current_user:
            work = current_user.get("work_details", {})
            user_role = str(work.get("system_role") or current_user.get("system_role", "Admin")).strip()
            creator_name = current_user.get("contact_info", {}).get("full_name") or current_user.get("full_name") or "Admin"
            data_dict["created_by"] = {
                "user_id": str(current_user.get("_id", "")),
                "name": creator_name,
                "role": user_role
            }

        created = await DocumentTypeRepository.create(data_dict)
        await clear_pattern("document_types:*")
        return created

    @staticmethod
    async def get_all_document_types(
        is_deleted: bool = False, 
        is_mandatory: Optional[bool] = None, 
        search: Optional[str] = None,
        page: Optional[int] = None,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        cache_key = make_list_key("document_types:list", is_deleted=is_deleted, is_mandatory=is_mandatory, search=search, page=page, limit=limit)
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        items = await DocumentTypeRepository.get_all(
            is_deleted=is_deleted, 
            is_mandatory=is_mandatory, 
            search=search,
            page=page,
            limit=limit
        )
        await set_cache(cache_key, items, ttl=1800)
        return items

    @staticmethod
    async def get_by_id(item_id: str) -> Optional[Dict[str, Any]]:
        cache_key = f"document_type:{item_id}"
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        item = await DocumentTypeRepository.get_by_id(item_id)
        if item:
            await set_cache(cache_key, item, ttl=1800)
        return item

    @staticmethod
    async def update_document_type(item_id: str, data: DocumentTypeUpdate) -> bool:
        update_dict = data.model_dump(exclude_unset=True)
        success = await DocumentTypeRepository.update(item_id, update_dict)
        if success:
            await clear_pattern("document_types:*")
            await delete_cache(f"document_type:{item_id}")
        return success

    @staticmethod
    async def delete_document_type(item_id: str) -> bool:
        success = await DocumentTypeRepository.delete(item_id)
        if success:
            await clear_pattern("document_types:*")
            await delete_cache(f"document_type:{item_id}")
        return success
