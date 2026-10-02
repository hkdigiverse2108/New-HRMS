from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, List
from app.schemas.document_template import DocumentTemplateCreate, DocumentTemplateUpdate, DocumentTemplateResponse
from app.services.document_template import DocumentTemplateService
from app.controllers.auth import get_current_employee

router = APIRouter(prefix="/document-templates", tags=["Document Templates"])

def check_admin_or_hr_role(user: dict):
    work = user.get("work_details", {})
    role = str(work.get("system_role") or user.get("system_role", "Employee")).strip()
    if role.lower() not in ["admin", "subadmin", "hr", "hr manager"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Admin or HR can manage document templates")
    return role

@router.post("", response_model=DocumentTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    data: DocumentTemplateCreate,
    current_user: dict = Depends(get_current_employee)
):
    check_admin_or_hr_role(current_user)
    return await DocumentTemplateService.create_template(data, current_user)

@router.get("/categories", response_model=List[str])
async def get_template_categories(current_user: dict = Depends(get_current_employee)):
    return await DocumentTemplateService.get_categories()

@router.get("", response_model=List[DocumentTemplateResponse])
async def get_all_templates(
    category: Optional[str] = Query(None, description="Filter by category e.g. Onboarding"),
    search: Optional[str] = Query(None, description="Search by name, category, content"),
    current_user: dict = Depends(get_current_employee)
):
    return await DocumentTemplateService.get_all_templates(is_deleted=False, category=category, search=search)

@router.get("/{item_id}", response_model=DocumentTemplateResponse)
async def get_template_by_id(
    item_id: str,
    current_user: dict = Depends(get_current_employee)
):
    item = await DocumentTemplateService.get_by_id(item_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document template not found")
    return item

@router.put("/{item_id}", response_model=DocumentTemplateResponse)
async def update_template(
    item_id: str,
    data: DocumentTemplateUpdate,
    current_user: dict = Depends(get_current_employee)
):
    check_admin_or_hr_role(current_user)
    item = await DocumentTemplateService.get_by_id(item_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document template not found")

    success = await DocumentTemplateService.update_template(item_id, data)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update document template")
    return await DocumentTemplateService.get_by_id(item_id)

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    item_id: str,
    current_user: dict = Depends(get_current_employee)
):
    check_admin_or_hr_role(current_user)
    item = await DocumentTemplateService.get_by_id(item_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document template not found")

    success = await DocumentTemplateService.delete_template(item_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete document template")
