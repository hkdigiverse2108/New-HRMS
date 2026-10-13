from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, List
from app.schemas.document_template import DocumentTemplateCreate, DocumentTemplateUpdate, DocumentTemplateResponse
from app.services.document_template import DocumentTemplateService
from app.controllers.auth import get_current_employee
from app.redis.service import get_cache, set_cache, clear_pattern, make_list_key

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
    created = await DocumentTemplateService.create_template(data, current_user)
    await clear_pattern("document_templates:*")
    return created

@router.get("/categories", response_model=List[str])
async def get_template_categories(current_user: dict = Depends(get_current_employee)):
    cache_key = "document_templates:categories"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    res = await DocumentTemplateService.get_categories()
    if res is not None:
        await set_cache(cache_key, res, ttl=300)
    return res

@router.get("", response_model=List[DocumentTemplateResponse])
async def get_all_templates(
    category: Optional[str] = Query(None, description="Filter by category e.g. Onboarding"),
    search: Optional[str] = Query(None, description="Search by name, category, content"),
    current_user: dict = Depends(get_current_employee)
):
    cache_key = make_list_key("document_templates:list", cat=category, s=search)
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    res = await DocumentTemplateService.get_all_templates(is_deleted=False, category=category, search=search)
    if res is not None:
        await set_cache(cache_key, res, ttl=120)
    return res

@router.get("/{item_id}", response_model=DocumentTemplateResponse)
async def get_template_by_id(
    item_id: str,
    current_user: dict = Depends(get_current_employee)
):
    cache_key = f"document_templates:item:{item_id}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    item = await DocumentTemplateService.get_by_id(item_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document template not found")

    await set_cache(cache_key, item, ttl=120)
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

    await clear_pattern("document_templates:*")
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
    await clear_pattern("document_templates:*")
