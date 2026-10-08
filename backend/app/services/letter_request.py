from datetime import datetime
from typing import Optional, List, Dict, Any
from bson import ObjectId
from app.repository.letter_request import LetterRequestRepository
from app.schemas.letter_request import LetterRequestCreate, LetterRequestUpdate, SendDocumentRequest
from app.services.document_generator import DocumentGeneratorService
from app.schemas.generated_document import DocumentGenerateRequest
from app.database.db import db

class LetterRequestService:
    @staticmethod
    async def create_request(data: LetterRequestCreate, current_user: dict) -> Dict[str, Any]:
        # Determine employee ID
        target_emp_id = data.employee_id
        if not target_emp_id:
            target_emp_id = str(current_user.get("_id") or current_user.get("id"))

        # Fetch employee info
        emp = None
        if ObjectId.is_valid(target_emp_id):
            emp = await db.db["employees"].find_one({"_id": ObjectId(target_emp_id), "is_deleted": False})

        if not emp:
            # Fallback check by employee string ID
            emp = await db.db["employees"].find_one({
                "$or": [
                    {"id": target_emp_id},
                    {"employee_id": target_emp_id},
                    {"work_details.employee_id": target_emp_id}
                ],
                "is_deleted": False
            })

        def format_emp_name(source: dict) -> tuple[str, str]:
            p_info = source.get("personal_info") or source.get("personal_details") or {}
            w_info = source.get("work_details") or {}
            
            fn = p_info.get("first_name") or source.get("first_name") or ""
            mn = p_info.get("middle_name") or source.get("middle_name") or ""
            ln = p_info.get("last_name") or source.get("last_name") or ""

            full = " ".join([f for f in [fn, mn, ln] if f]).strip()
            if not full:
                full = source.get("name") or p_info.get("email_address") or source.get("email") or "Employee"

            code = w_info.get("employee_id") or source.get("employee_id") or source.get("emp_id") or ""
            return full, code

        if emp:
            emp_name, emp_code = format_emp_name(emp)
        else:
            emp_name, emp_code = format_emp_name(current_user)

        # Fetch Document Type info if provided
        doc_type_name = None
        if data.document_type_id and ObjectId.is_valid(data.document_type_id):
            dt = await db.db["document_types"].find_one({"_id": ObjectId(data.document_type_id), "is_deleted": False})
            if dt:
                doc_type_name = dt.get("name")

        # Fetch Template info if provided
        tpl_id = data.template_id
        tpl_name = None

        if tpl_id and ObjectId.is_valid(tpl_id):
            tpl = await db.db["document_templates"].find_one({"_id": ObjectId(tpl_id), "is_deleted": False})
            if tpl:
                tpl_name = tpl.get("template_name")
        elif data.letter_type:
            import re
            tpl = await db.db["document_templates"].find_one({
                "template_name": {"$regex": f"^{re.escape(data.letter_type)}$", "$options": "i"},
                "is_deleted": False
            })
            if tpl:
                tpl_id = str(tpl["_id"])
                tpl_name = tpl.get("template_name")

        letter_title = data.letter_type or tpl_name or doc_type_name or "Official Letter"

        payload = {
            "employee_id": target_emp_id,
            "employee_name": emp_name,
            "employee_code": emp_code,
            "document_type_id": data.document_type_id,
            "letter_type": letter_title,
            "template_id": tpl_id,
            "template_name": tpl_name,
            "requested_date": datetime.utcnow().strftime("%Y-%m-%d"),
            "needed_by_date": data.needed_by_date or datetime.utcnow().strftime("%Y-%m-%d"),
            "reason": data.reason or "Document sent for signature",
            "status": data.status or "Pending",
            "generated_document_id": data.generated_document_id,
            "pdf_url": data.pdf_url,
            "content": data.content,
            "rejection_reason": None,
        }

        request_id = await LetterRequestRepository.create(payload)
        return await LetterRequestRepository.get_by_id(request_id)

    @staticmethod
    async def get_all_requests(
        is_deleted: bool = False,
        employee_id: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        return await LetterRequestRepository.get_all(
            is_deleted=is_deleted,
            employee_id=employee_id,
            status=status,
            search=search
        )

    @staticmethod
    async def get_by_id(item_id: str) -> Optional[Dict[str, Any]]:
        return await LetterRequestRepository.get_by_id(item_id)

    @staticmethod
    async def update_request(item_id: str, data: LetterRequestUpdate) -> Optional[Dict[str, Any]]:
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        if not update_dict:
            return await LetterRequestRepository.get_by_id(item_id)

        success = await LetterRequestRepository.update(item_id, update_dict)
        if success:
            return await LetterRequestRepository.get_by_id(item_id)
        return None

    @staticmethod
    async def send_document(item_id: str, send_data: SendDocumentRequest, current_user: dict) -> Optional[Dict[str, Any]]:
        req = await LetterRequestRepository.get_by_id(item_id)
        if not req:
            return None

        gen_doc_id = send_data.generated_document_id
        pdf_url = None

        target_template_id = send_data.template_id or req.get("template_id")

        if not gen_doc_id and target_template_id:
            # Generate document automatically
            gen_req = DocumentGenerateRequest(
                template_id=target_template_id,
                employee_id=req["employee_id"],
                placeholder_values=send_data.placeholder_values or {}
            )
            created_doc = await DocumentGeneratorService.generate_document(gen_req, current_user)
            if created_doc:
                gen_doc_id = created_doc["id"]
                pdf_url = f"/generated-documents/{gen_doc_id}/pdf"
        elif gen_doc_id:
            pdf_url = f"/generated-documents/{gen_doc_id}/pdf"

        update_payload = {
            "status": "Sent",
            "generated_document_id": gen_doc_id,
            "pdf_url": pdf_url
        }

        await LetterRequestRepository.update(item_id, update_payload)
        return await LetterRequestRepository.get_by_id(item_id)

    @staticmethod
    async def approve_request(item_id: str, current_user: dict) -> Optional[Dict[str, Any]]:
        req = await LetterRequestRepository.get_by_id(item_id)
        if not req:
            return None

        update_payload = {"status": "Approved"}
        await LetterRequestRepository.update(item_id, update_payload)
        return await LetterRequestRepository.get_by_id(item_id)

    @staticmethod
    async def reject_request(item_id: str, reason: Optional[str] = None) -> Optional[Dict[str, Any]]:
        req = await LetterRequestRepository.get_by_id(item_id)
        if not req:
            return None

        update_payload = {
            "status": "Rejected",
            "rejection_reason": reason or "Request rejected"
        }
        await LetterRequestRepository.update(item_id, update_payload)
        return await LetterRequestRepository.get_by_id(item_id)

    @staticmethod
    async def delete_request(item_id: str) -> bool:
        return await LetterRequestRepository.delete(item_id)
