import os
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import FileResponse
from typing import Optional, List
from app.schemas.generated_document import (
    DocumentPreviewRequest, DocumentPreviewResponse,
    DocumentGenerateRequest, GeneratedDocumentResponse
)
from app.services.document_generator import DocumentGeneratorService
from app.controllers.auth import get_current_employee

router = APIRouter(prefix="/generated-documents", tags=["Generated Documents & PDF Engine"])

def check_admin_or_hr_role(user: dict):
    work = user.get("work_details", {})
    role = str(work.get("system_role") or user.get("system_role", "Employee")).strip()
    if role.lower() not in ["admin", "subadmin", "hr", "hr manager"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Admin or HR can generate documents")
    return role

@router.post("/preview", response_model=DocumentPreviewResponse)
async def preview_document(
    data: DocumentPreviewRequest,
    current_user: dict = Depends(get_current_employee)
):
    check_admin_or_hr_role(current_user)
    res = await DocumentGeneratorService.preview_document(data)
    if not res:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template or Employee not found")
    return res

@router.post("/generate", response_model=GeneratedDocumentResponse, status_code=status.HTTP_201_CREATED)
async def generate_document(
    data: DocumentGenerateRequest,
    current_user: dict = Depends(get_current_employee)
):
    check_admin_or_hr_role(current_user)
    created = await DocumentGeneratorService.generate_document(data, current_user)
    if not created:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to generate document")
    return created

@router.get("", response_model=List[GeneratedDocumentResponse])
async def get_all_generated_documents(
    employee_id: Optional[str] = Query(None, description="Filter by employee ID"),
    template_id: Optional[str] = Query(None, description="Filter by template ID"),
    search: Optional[str] = Query(None, description="Search by template name or employee name"),
    current_user: dict = Depends(get_current_employee)
):
    return await DocumentGeneratorService.get_all_generated_documents(
        is_deleted=False,
        employee_id=employee_id,
        template_id=template_id,
        search=search
    )

@router.get("/{item_id}/pdf")
async def download_generated_document_pdf(
    item_id: str,
    current_user: dict = Depends(get_current_employee)
):
    item = await DocumentGeneratorService.get_by_id(item_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generated document not found")

    pdf_path = item.get("pdf_path")
    if not pdf_path or not os.path.exists(os.path.abspath(pdf_path)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDF file not found on disk")

    abs_path = os.path.abspath(pdf_path)
    file_title = f"{item.get('template_name', 'document')}_{item.get('employee_code', 'EMP')}.pdf"
    return FileResponse(
        path=abs_path,
        media_type="application/pdf",
        filename=file_title,
        content_disposition_type="inline"
    )

@router.get("/{item_id}", response_model=GeneratedDocumentResponse)
async def get_generated_document_by_id(
    item_id: str,
    current_user: dict = Depends(get_current_employee)
):
    item = await DocumentGeneratorService.get_by_id(item_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generated document not found")
    return item

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_generated_document(
    item_id: str,
    current_user: dict = Depends(get_current_employee)
):
    check_admin_or_hr_role(current_user)
    item = await DocumentGeneratorService.get_by_id(item_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generated document not found")

    success = await DocumentGeneratorService.delete_generated_document(item_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete generated document")
