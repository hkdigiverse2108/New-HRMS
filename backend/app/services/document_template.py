import re
from typing import List, Dict, Any, Optional
from app.repository.document_template import DocumentTemplateRepository
from app.schemas.document_template import DocumentTemplateCreate, DocumentTemplateUpdate
from app.redis.service import get_cache, set_cache, delete_cache, clear_pattern, make_list_key

class DocumentTemplateService:

    @staticmethod
    def extract_placeholders(html_content: str) -> List[str]:
        """
        Regex scanner to extract unique placeholder keys inside {{ variable_name }} tags.
        """
        if not html_content:
            return []
        matches = re.findall(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}", html_content)
        seen = set()
        unique = []
        for m in matches:
            clean = m.strip()
            if clean and clean not in seen:
                seen.add(clean)
                unique.append(clean)
        return unique

    @staticmethod
    async def create_template(data: DocumentTemplateCreate, current_user: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        data_dict = data.model_dump(exclude_unset=True)
        data_dict["placeholders"] = DocumentTemplateService.extract_placeholders(data_dict.get("content", ""))

        if current_user:
            work = current_user.get("work_details", {})
            user_role = str(work.get("system_role") or current_user.get("system_role", "Admin")).strip()
            creator_name = current_user.get("contact_info", {}).get("full_name") or current_user.get("full_name") or "Admin"
            data_dict["created_by"] = {
                "user_id": str(current_user.get("_id", "")),
                "name": creator_name,
                "role": user_role
            }

        created = await DocumentTemplateRepository.create(data_dict)
        await clear_pattern("document_templates:*")
        return created

    @staticmethod
    async def get_all_templates(is_deleted: bool = False, category: Optional[str] = None, search: Optional[str] = None) -> List[Dict[str, Any]]:
        cache_key = make_list_key("document_templates:list", is_deleted=is_deleted, category=category, search=search)
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        items = await DocumentTemplateRepository.get_all(is_deleted=is_deleted, category=category, search=search)
        await set_cache(cache_key, items, ttl=1800)
        return items

    @staticmethod
    async def get_categories() -> List[str]:
        return await DocumentTemplateRepository.get_categories()

    @staticmethod
    async def get_by_id(item_id: str) -> Optional[Dict[str, Any]]:
        cache_key = f"document_template:{item_id}"
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        item = await DocumentTemplateRepository.get_by_id(item_id)
        if item:
            await set_cache(cache_key, item, ttl=1800)
        return item

    @staticmethod
    async def update_template(item_id: str, data: DocumentTemplateUpdate) -> bool:
        update_dict = data.model_dump(exclude_unset=True)
        if "content" in update_dict:
            update_dict["placeholders"] = DocumentTemplateService.extract_placeholders(update_dict["content"])

        success = await DocumentTemplateRepository.update(item_id, update_dict)
        if success:
            await clear_pattern("document_templates:*")
            await delete_cache(f"document_template:{item_id}")
        return success

    @staticmethod
    async def delete_template(item_id: str) -> bool:
        success = await DocumentTemplateRepository.delete(item_id)
        if success:
            await clear_pattern("document_templates:*")
            await delete_cache(f"document_template:{item_id}")
        return success
