import os
from typing import List, Dict, Any, Optional
from app.repository.submitted_document import SubmittedDocumentRepository
from app.repository.document_type import DocumentTypeRepository
from app.repository.employee import EmployeeRepository
from app.utils.storage import UPLOADS_DIR, ensure_upload_dirs, delete_pdf_file
from app.redis.service import get_cache, set_cache, delete_cache, clear_pattern, make_list_key

class SubmittedDocumentService:

    @staticmethod
    async def save_submitted_file(file_bytes: bytes, original_filename: str, employee_code: str) -> tuple[str, str]:
        ensure_upload_dirs()
        folder_path = os.path.join(UPLOADS_DIR, "documents", "submitted")
        
        clean_ext = os.path.splitext(original_filename)[1].lower() or ".pdf"
        base_name = os.path.splitext(original_filename)[0]
        safe_base = "".join(c for c in base_name if c.isalnum() or c in ("-", "_")).strip()
        filename = f"{safe_base}_{employee_code}{clean_ext}"
        
        full_path = os.path.join(folder_path, filename)
        with open(full_path, "wb") as f:
            f.write(file_bytes)

        rel_path = os.path.relpath(full_path, start=os.getcwd()).replace("\\", "/")
        web_url = f"/uploads/documents/submitted/{filename}"
        return rel_path, web_url

    @staticmethod
    async def create_submitted_document(
        employee_id: str,
        document_type_id: str,
        date: Optional[str] = None,
        status: Optional[str] = "Pending",
        file_bytes: Optional[bytes] = None,
        original_filename: Optional[str] = None,
        current_user: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        employee = await EmployeeRepository.get_by_id(employee_id)
        if not employee or employee.get("is_deleted"):
            return None

        doc_type = await DocumentTypeRepository.get_by_id(document_type_id)
        if not doc_type or doc_type.get("is_deleted"):
            return None

        # Check duplicate submitted document for this employee
        existing_docs = await SubmittedDocumentRepository.get_all(
            is_deleted=False,
            employee_id=str(employee["_id"]),
            document_type_id=str(doc_type["_id"])
        )
        if existing_docs:
            from fastapi import HTTPException, status as status_code
            doc_name = doc_type.get("name", "document type")
            raise HTTPException(
                status_code=status_code.HTTP_400_BAD_REQUEST,
                detail=f"This document type '{doc_name}' has already been added for this employee. Duplicate entry is not allowed."
            )

        contact = employee.get("contact_info", {}) or {}
        emp_name = str(contact.get("full_name") or employee.get("full_name") or "Employee").strip()
        emp_code = str(employee.get("employee_code") or employee.get("employee_id") or str(employee["_id"])[:6]).strip()

        rel_path, web_url = None, None
        if file_bytes and original_filename:
            rel_path, web_url = await SubmittedDocumentService.save_submitted_file(file_bytes, original_filename, emp_code)

        uploader_info = None
        if current_user:
            work = current_user.get("work_details", {})
            user_role = str(work.get("system_role") or current_user.get("system_role", "Admin")).strip()
            creator_name = current_user.get("contact_info", {}).get("full_name") or current_user.get("full_name") or "Admin"
            uploader_info = {
                "user_id": str(current_user.get("_id", "")),
                "name": creator_name,
                "role": user_role
            }

        rec_date = date or datetime.utcnow().strftime("%Y-%m-%d")

        doc_record = {
            "employee_id": str(employee["_id"]),
            "employee_name": emp_name,
            "employee_code": emp_code,
            "document_type_id": str(doc_type["_id"]),
            "document_type_name": doc_type.get("name", "Document"),
            "date": rec_date,
            "status": status or "Accepted",
            "uploaded_by": uploader_info
        }
        if rel_path:
            doc_record["file_name"] = original_filename
            doc_record["file_path"] = rel_path
            doc_record["file_url"] = web_url

        created = await SubmittedDocumentRepository.create(doc_record)
        await clear_pattern("submitted_documents:*")
        return created

    @staticmethod
    async def get_all_submitted_documents(
        is_deleted: bool = False, 
        employee_id: Optional[str] = None, 
        document_type_id: Optional[str] = None, 
        status: Optional[str] = None, 
        search: Optional[str] = None,
        page: Optional[int] = None,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        cache_key = make_list_key("submitted_documents:list", is_deleted=is_deleted, employee_id=employee_id, document_type_id=document_type_id, status=status, search=search, page=page, limit=limit)
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        items = await SubmittedDocumentRepository.get_all(
            is_deleted=is_deleted, 
            employee_id=employee_id, 
            document_type_id=document_type_id, 
            status=status, 
            search=search,
            page=page,
            limit=limit
        )
        await set_cache(cache_key, items, ttl=1800)
        return items

    @staticmethod
    async def get_my_submitted_documents(
        employee_id: str, 
        document_type_id: Optional[str] = None, 
        status: Optional[str] = None, 
        search: Optional[str] = None,
        page: Optional[int] = None,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        return await SubmittedDocumentService.get_all_submitted_documents(
            is_deleted=False, 
            employee_id=employee_id, 
            document_type_id=document_type_id, 
            status=status, 
            search=search,
            page=page,
            limit=limit
        )

    @staticmethod
    async def get_by_id(item_id: str) -> Optional[Dict[str, Any]]:
        cache_key = f"submitted_document:{item_id}"
        cached = await get_cache(cache_key)
        if cached is not None:
            return cached

        item = await SubmittedDocumentRepository.get_by_id(item_id)
        if item:
            await set_cache(cache_key, item, ttl=1800)
        return item

    @staticmethod
    async def update_submitted_document(item_id: str, data_dict: dict) -> bool:
        success = await SubmittedDocumentRepository.update(item_id, data_dict)
        if success:
            await clear_pattern("submitted_documents:*")
            await delete_cache(f"submitted_document:{item_id}")
        return success

    @staticmethod
    async def delete_submitted_document(item_id: str) -> bool:
        item = await SubmittedDocumentRepository.get_by_id(item_id)
        if item and item.get("file_path"):
            delete_pdf_file(item.get("file_path"))

        success = await SubmittedDocumentRepository.delete(item_id)
        if success:
            await clear_pattern("submitted_documents:*")
            await delete_cache(f"submitted_document:{item_id}")
        return success
