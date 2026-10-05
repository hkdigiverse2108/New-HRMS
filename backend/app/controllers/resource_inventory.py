from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, List
from app.schemas.resource_inventory import (
    ResourceInventoryUpdate, ResourceInventoryResponse, ResourceInventoryPaginatedResponse, ResourceDashboardResponse
)
from app.services.resource_inventory import ResourceInventoryService
from app.controllers.auth import get_current_employee

router = APIRouter(prefix="/resource-inventory", tags=["Resource Management & Inventory"])

@router.get("/dashboard", response_model=ResourceDashboardResponse)
async def get_resource_inventory_dashboard(
    current_user: dict = Depends(get_current_employee)
):
    """
    Get Resource & Inventory Dashboard KPI metrics and Category Summary table.
    (Requires 'read' permission).
    """
    return await ResourceInventoryService.get_dashboard(current_user)

@router.get("/my-resources", response_model=ResourceInventoryPaginatedResponse)
async def get_my_allocated_resources(
    search: Optional[str] = Query(None, description="Search by resource_id or category_name"),
    page: int = Query(1, ge=1, description="Page number (default: 1)"),
    limit: int = Query(10, ge=1, le=100, description="Items per page (default: 10)"),
    current_user: dict = Depends(get_current_employee)
):
    """
    Get all inventory resources allocated to the logged-in employee.
    """
    return await ResourceInventoryService.get_my_resources(
        current_user,
        search=search,
        page=page,
        limit=limit
    )

@router.get("", response_model=ResourceInventoryPaginatedResponse)
async def get_all_resource_inventory_items(
    category_id: Optional[str] = Query(None, description="Filter by Category ID"),
    status: Optional[str] = Query(None, description="Filter by Status: Available, Allocated, Maintenance"),
    condition: Optional[str] = Query(None, description="Filter by Condition: New, Good, Fair, Poor"),
    assigned_to_employee_id: Optional[str] = Query(None, description="Filter by Assigned Employee ID or 'unassigned'"),
    search: Optional[str] = Query(None, description="Search by resource_id, category_name, assigned_to_name"),
    page: int = Query(1, ge=1, description="Page number (default: 1)"),
    limit: int = Query(10, ge=1, le=100, description="Items per page (default: 10)"),
    current_user: dict = Depends(get_current_employee)
):
    """
    Get all inventory items with filter options and pagination (Requires 'read' permission).
    """
    return await ResourceInventoryService.get_all_inventory(
        current_user,
        category_id=category_id,
        status=status,
        condition=condition,
        assigned_to_employee_id=assigned_to_employee_id,
        search=search,
        page=page,
        limit=limit
    )

@router.get("/{item_id}", response_model=ResourceInventoryResponse)
async def get_resource_inventory_item_by_id(
    item_id: str,
    current_user: dict = Depends(get_current_employee)
):
    """Get details of a single inventory item by ID (Requires 'read' permission)."""
    item = await ResourceInventoryService.get_by_id(item_id, current_user)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory item not found")
    return item

@router.put("/{item_id}", response_model=ResourceInventoryResponse)
async def update_resource_inventory_item(
    item_id: str,
    data: ResourceInventoryUpdate,
    current_user: dict = Depends(get_current_employee)
):
    """
    Update condition (New/Good/Fair/Poor), status (Available/Allocated/Maintenance),
    or assign/unassign an inventory item to an employee.
    (Requires 'edit' permission).
    """
    return await ResourceInventoryService.update_inventory_item(item_id, data, current_user)

@router.delete("/{item_id}")
async def delete_resource_inventory_item(
    item_id: str,
    current_user: dict = Depends(get_current_employee)
):
    """
    Inventory items are tied to Category count.
    To reduce inventory items, update Category with 'remove_resources' count.
    """
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Inventory items are managed via Category count. To reduce items, update 'remove_resources' count in Category Edit."
    )
