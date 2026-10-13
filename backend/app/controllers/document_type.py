from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, List
from app.schemas.document_type import DocumentTypeCreate, DocumentTypeUpdate, DocumentTypeResponse
from app.services.document_type import DocumentTypeService
from app.controllers.auth import get_current_employee
from app.redis.service import get_cache, set_cache, clear_pattern, make_list_key

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
    await clear_pattern("document_types:*")
    return created

@router.get("", response_model=List[DocumentTypeResponse])
async def get_all_document_types(
    is_mandatory: Optional[bool] = Query(None, description="Filter by mandatory status"),
    search: Optional[str] = Query(None, description="Search by name or description"),
    page: Optional[int] = Query(None, ge=1, description="Page number for pagination"),
    limit: Optional[int] = Query(None, ge=1, le=1000, description="Items per page limit"),
    current_user: dict = Depends(get_current_employee)
):
    cache_key = make_list_key("document_types:list", m=is_mandatory, s=search, p=page, l=limit)
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    res = await DocumentTypeService.get_all_document_types(
        is_deleted=False, 
        is_mandatory=is_mandatory, 
        search=search,
        page=page,
        limit=limit
    )
    if res is not None:
        await set_cache(cache_key, res, ttl=120)
    return res

@router.get("/{item_id}", response_model=DocumentTypeResponse)
async def get_document_type_by_id(
    item_id: str,
    current_user: dict = Depends(get_current_employee)
):
    cache_key = f"document_types:item:{item_id}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    item = await DocumentTypeService.get_by_id(item_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document type not found")

    await set_cache(cache_key, item, ttl=120)
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

    await clear_pattern("document_types:*")
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
    await clear_pattern("document_types:*")
