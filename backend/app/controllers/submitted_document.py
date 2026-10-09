import os
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from fastapi.responses import FileResponse
from typing import Optional, List
from app.schemas.submitted_document import SubmittedDocumentCreate, SubmittedDocumentUpdate, SubmittedDocumentResponse
from app.services.submitted_document import SubmittedDocumentService
from app.repository.document_type import DocumentTypeRepository
from app.controllers.auth import get_current_employee

router = APIRouter(prefix="/submitted-documents", tags=["Submitted Employee Documents Portal"])

def check_admin_or_hr_role(user: dict):
    work = user.get("work_details", {})
    role = str(work.get("system_role") or user.get("system_role", "Employee")).strip()
    if role.lower() not in ["admin", "subadmin", "hr", "hr manager"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Admin or HR can upload and manage employee submitted documents")
    return role

@router.post("", response_model=SubmittedDocumentResponse, status_code=status.HTTP_201_CREATED)
async def create_submitted_document_json(
    data: SubmittedDocumentCreate,
    current_user: dict = Depends(get_current_employee)
):
    """Creates a submitted document record using JSON body."""
    check_admin_or_hr_role(current_user)

    created = await SubmittedDocumentService.create_submitted_document(
        employee_id=data.employee_id,
        document_type_id=data.document_type_id,
        date=data.date,
        status=data.status or "Accepted",
        file_bytes=None,
        original_filename=None,
        current_user=current_user
    )
    if not created:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to add submitted document. Invalid Employee or Document Type.")
    return created

@router.post("/upload", response_model=SubmittedDocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_submitted_document_file(
    employee_id: str = Form(..., description="ID of employee document belongs to"),
    document_type_id: str = Form(..., description="ID of document type"),
    date: Optional[str] = Form(None, description="Document date DD-MM-YYYY or YYYY-MM-DD"),
    doc_status: Optional[str] = Form("Accepted", alias="status", description="Status: Pending, Accepted, Rejected, Returned to Employee"),
    file: Optional[UploadFile] = File(None, description="Document scan/file upload"),
    current_user: dict = Depends(get_current_employee)
):
    """Creates a submitted document record with file scan upload using multipart/form-data."""
    check_admin_or_hr_role(current_user)

    file_bytes = None
    orig_filename = None
    if file and file.filename:
        file_bytes = await file.read()
        orig_filename = file.filename

    created = await SubmittedDocumentService.create_submitted_document(
        employee_id=employee_id,
        document_type_id=document_type_id,
        date=date,
        status=doc_status or "Accepted",
        file_bytes=file_bytes,
        original_filename=orig_filename,
        current_user=current_user
    )
    if not created:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to upload submitted document. Invalid Employee or Document Type.")
    return created

@router.get("/my-documents", response_model=List[SubmittedDocumentResponse])
async def get_my_submitted_documents(
    document_type_id: Optional[str] = Query(None, description="Filter by document type ID"),
    status: Optional[str] = Query(None, description="Filter by status (approved, pending, rejected, all)"),
    search: Optional[str] = Query(None, description="Search by document type name or number"),
    page: Optional[int] = Query(None, ge=1, description="Page number for pagination"),
    limit: Optional[int] = Query(None, ge=1, le=1000, description="Items per page limit"),
    current_user: dict = Depends(get_current_employee)
):
    """Employee Portal View: Returns submitted documents for logged in employee with filters."""
    my_employee_id = str(current_user.get("_id", ""))
    return await SubmittedDocumentService.get_my_submitted_documents(
        employee_id=my_employee_id,
        document_type_id=document_type_id,
        status=status,
        search=search,
        page=page,
        limit=limit
    )

@router.get("", response_model=List[SubmittedDocumentResponse])
async def get_all_submitted_documents(
    employee_id: Optional[str] = Query(None, description="Filter by employee ID"),
    document_type_id: Optional[str] = Query(None, description="Filter by document type ID"),
    status: Optional[str] = Query(None, description="Filter by status (approved, pending, rejected, all)"),
    search: Optional[str] = Query(None, description="Search by employee name, code, document type name or number"),
    page: Optional[int] = Query(None, ge=1, description="Page number for pagination"),
    limit: Optional[int] = Query(None, ge=1, le=1000, description="Items per page limit"),
    current_user: dict = Depends(get_current_employee)
):
    work = current_user.get("work_details", {})
    role = str(work.get("system_role") or current_user.get("system_role", "Employee")).strip().lower()
    if role not in ["admin", "subadmin", "hr", "hr manager"]:
        # Standard employee can only see their own documents
        employee_id = str(current_user.get("_id", ""))

    return await SubmittedDocumentService.get_all_submitted_documents(
        is_deleted=False,
        employee_id=employee_id,
        document_type_id=document_type_id,
        status=status,
        search=search,
        page=page,
        limit=limit
    )

@router.get("/{item_id}/download")
async def download_submitted_document_file(
    item_id: str,
    current_user: dict = Depends(get_current_employee)
):
    item = await SubmittedDocumentService.get_by_id(item_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submitted document not found")

    # Security check: User can view if Admin/HR or if document belongs to logged-in employee
    is_admin = False
    try:
        check_admin_or_hr_role(current_user)
        is_admin = True
    except HTTPException:
        pass

    my_id = str(current_user.get("_id", ""))
    if not is_admin and str(item.get("employee_id", "")) != my_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to access this document")

    file_path = item.get("file_path")
    if not file_path or not os.path.exists(os.path.abspath(file_path)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document file not found on disk")

    abs_path = os.path.abspath(file_path)
    file_title = item.get("file_name") or f"document_{item.get('employee_code', 'EMP')}.pdf"
    return FileResponse(
        path=abs_path,
        filename=file_title,
        content_disposition_type="inline"
    )

@router.get("/{item_id}", response_model=SubmittedDocumentResponse)
async def get_submitted_document_by_id(
    item_id: str,
    current_user: dict = Depends(get_current_employee)
):
    item = await SubmittedDocumentService.get_by_id(item_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submitted document not found")

    is_admin = False
    try:
        check_admin_or_hr_role(current_user)
        is_admin = True
    except HTTPException:
        pass

    my_id = str(current_user.get("_id", ""))
    if not is_admin and str(item.get("employee_id", "")) != my_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view this document")

    return item

@router.put("/{item_id}", response_model=SubmittedDocumentResponse)
async def update_submitted_document(
    item_id: str,
    data: SubmittedDocumentUpdate,
    current_user: dict = Depends(get_current_employee)
):
    check_admin_or_hr_role(current_user)
    item = await SubmittedDocumentService.get_by_id(item_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submitted document not found")

    update_dict = data.model_dump(exclude_unset=True)
    if update_dict.get("document_type_id"):
        doc_type = await DocumentTypeRepository.get_by_id(update_dict["document_type_id"])
        if doc_type:
            update_dict["document_type_name"] = doc_type.get("name", "Document")

    success = await SubmittedDocumentService.update_submitted_document(item_id, update_dict)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update submitted document")

    return await SubmittedDocumentService.get_by_id(item_id)

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_submitted_document(
    item_id: str,
    current_user: dict = Depends(get_current_employee)
):
    check_admin_or_hr_role(current_user)
    item = await SubmittedDocumentService.get_by_id(item_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submitted document not found")

    success = await SubmittedDocumentService.delete_submitted_document(item_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete submitted document")
