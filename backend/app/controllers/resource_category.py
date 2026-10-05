from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, List
from app.schemas.resource_category import (
    ResourceCategoryCreate, ResourceCategoryUpdate, ResourceCategoryResponse, ResourceCategoryPaginatedResponse
)
from app.services.resource_category import ResourceCategoryService
from app.controllers.auth import get_current_employee

router = APIRouter(prefix="/resource-categories", tags=["Resource Management & Asset Categories"])

@router.post("", response_model=ResourceCategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_resource_category(
    data: ResourceCategoryCreate,
    current_user: dict = Depends(get_current_employee)
):
    """Create a new Resource/Asset Category (Requires 'create' permission)."""
    return await ResourceCategoryService.create_category(data, current_user)

@router.get("", response_model=ResourceCategoryPaginatedResponse)
async def get_all_resource_categories(
    search: Optional[str] = Query(None, description="Search by category name or description"),
    page: int = Query(1, ge=1, description="Page number (default: 1)"),
    limit: int = Query(10, ge=1, le=100, description="Items per page (default: 10)"),
    current_user: dict = Depends(get_current_employee)
):
    """Get all resource categories with search and pagination (Requires 'read' permission)."""
    return await ResourceCategoryService.get_all_categories(current_user, search=search, page=page, limit=limit)

@router.get("/{item_id}", response_model=ResourceCategoryResponse)
async def get_resource_category_by_id(
    item_id: str,
    current_user: dict = Depends(get_current_employee)
):
    """Get a single resource category by ID (Requires 'read' permission)."""
    item = await ResourceCategoryService.get_by_id(item_id, current_user)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource category not found")
    return item

@router.put("/{item_id}", response_model=ResourceCategoryResponse)
async def update_resource_category(
    item_id: str,
    data: ResourceCategoryUpdate,
    current_user: dict = Depends(get_current_employee)
):
    """
    Update a resource category.
    Allows editing Category Name, Description, and Adding/Removing resource inventory count.
    (Requires 'edit' permission).
    """
    return await ResourceCategoryService.update_category(item_id, data, current_user)

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resource_category(
    item_id: str,
    current_user: dict = Depends(get_current_employee)
):
    """Delete a resource category (Requires 'delete' permission)."""
    success = await ResourceCategoryService.delete_category(item_id, current_user)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete resource category")
