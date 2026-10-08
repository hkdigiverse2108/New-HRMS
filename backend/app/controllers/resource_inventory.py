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
    Deletes an inventory item and automatically decrements the associated category total resources count.
    (Requires 'delete' permission).
    """
    success = await ResourceInventoryService.delete_inventory_item(item_id, current_user)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete inventory item")
    return {"message": "Inventory item deleted and category total resources count updated successfully"}

@router.get("/logs")
async def get_resource_activity_logs(
    target_type: Optional[str] = Query(None),
    target_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_employee)
):
    """Get activity logs for inventory items and categories."""
    from app.repository.resource_activity_log import ResourceActivityLogRepository
    logs = await ResourceActivityLogRepository.get_logs(target_type=target_type, target_id=target_id, limit=100)
    inventory_logs = [l for l in logs if l.get("target_type") == "resource"]
    category_logs = [l for l in logs if l.get("target_type") == "category"]
    return {
        "items": logs,
        "inventory_logs": inventory_logs,
        "category_logs": category_logs
    }

@router.get("/logs/{target_type}/{target_id}")
async def get_item_activity_logs(
    target_type: str,
    target_id: str,
    current_user: dict = Depends(get_current_employee)
):
    """Get activity logs for a specific inventory resource or category."""
    from app.repository.resource_activity_log import ResourceActivityLogRepository
    logs = await ResourceActivityLogRepository.get_logs(target_type=target_type, target_id=target_id, limit=50)
    return {"items": logs}
