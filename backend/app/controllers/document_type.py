from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, List
from app.schemas.document_type import DocumentTypeCreate, DocumentTypeUpdate, DocumentTypeResponse
from app.services.document_type import DocumentTypeService
from app.controllers.auth import get_current_employee

router = APIRouter(prefix="/document-types", tags=["Document Types"])

def check_admin_or_hr_role(user: dict):
    work = user.get("work_details", {})
    role = str(work.get("system_role") or user.get("system_role", "Employee")).strip()
    if role.lower() not in ["admin", "subadmin", "hr", "hr manager"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Admin or HR can manage document types")
    return role

@router.post("", response_model=DocumentTypeResponse, status_code=status.HTTP_201_CREATED)
async def create_document_type(
    data: DocumentTypeCreate,
    current_user: dict = Depends(get_current_employee)
):
    check_admin_or_hr_role(current_user)
    created = await DocumentTypeService.create_document_type(data, current_user)
    return created

@router.get("", response_model=List[DocumentTypeResponse])
async def get_all_document_types(
    is_mandatory: Optional[bool] = Query(None, description="Filter by mandatory status"),
    search: Optional[str] = Query(None, description="Search by name or description"),
    page: Optional[int] = Query(None, ge=1, description="Page number for pagination"),
    limit: Optional[int] = Query(None, ge=1, le=1000, description="Items per page limit"),
    current_user: dict = Depends(get_current_employee)
):
    return await DocumentTypeService.get_all_document_types(
        is_deleted=False, 
        is_mandatory=is_mandatory, 
        search=search,
        page=page,
        limit=limit
    )

@router.get("/{item_id}", response_model=DocumentTypeResponse)
async def get_document_type_by_id(
    item_id: str,
    current_user: dict = Depends(get_current_employee)
):
    item = await DocumentTypeService.get_by_id(item_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document type not found")
    return item

@router.put("/{item_id}", response_model=DocumentTypeResponse)
async def update_document_type(
    item_id: str,
    data: DocumentTypeUpdate,
    current_user: dict = Depends(get_current_employee)
):
    check_admin_or_hr_role(current_user)
    item = await DocumentTypeService.get_by_id(item_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document type not found")

    success = await DocumentTypeService.update_document_type(item_id, data)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update document type")
    return await DocumentTypeService.get_by_id(item_id)

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document_type(
    item_id: str,
    current_user: dict = Depends(get_current_employee)
):
    check_admin_or_hr_role(current_user)
    item = await DocumentTypeService.get_by_id(item_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document type not found")

    success = await DocumentTypeService.delete_document_type(item_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete document type")
