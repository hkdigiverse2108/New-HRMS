from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime

class ResourceInventoryUpdate(BaseModel):
    resource_id: Optional[str] = Field(None, description="Formatted Unique ID e.g. HK-PRI-001 or custom asset ID")
    asset_id: Optional[str] = Field(None, description="Alias for resource_id")
    condition: Optional[str] = Field(None, description="Condition: New, Good, Fair, Poor")
    status: Optional[str] = Field(None, description="Status: Available, Allocated, Maintenance")
    assigned_to_employee_id: Optional[str] = Field(None, description="ID of employee to allocate resource to, or empty string to unassign")
    assigned_to_name: Optional[str] = Field(None, description="Name of employee assigned to")
    category_id: Optional[str] = Field(None, description="Category ID")
    category_name: Optional[str] = Field(None, description="Category Name")
    serial_number: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None

    model_config = ConfigDict(extra="allow")

class ResourceInventoryResponse(BaseModel):
    id: str = Field(alias="_id")
    resource_id: str = Field(..., description="Formatted Unique ID e.g. HK-PRI-001")
    category_id: Optional[str] = ""
    category_name: Optional[str] = ""
    condition: Optional[str] = "New"
    status: Optional[str] = "Available"
    assigned_to: Optional[Dict[str, Any]] = None
    serial_number: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    created_by: Optional[Dict[str, Any]] = None
    is_deleted: Optional[bool] = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(populate_by_name=True, extra="allow")

class ResourceInventoryPaginatedResponse(BaseModel):
    items: List[ResourceInventoryResponse]
    data: List[ResourceInventoryResponse]
    total: int
    page: int
    limit: int
    total_pages: int

    model_config = ConfigDict(populate_by_name=True)

class CategoryInventorySummaryItem(BaseModel):
    category_id: str
    category_name: str
    total_items: int = 0
    available_stock: int = 0
    allocated_assigned: int = 0
    in_maintenance: int = 0
    allocation_ratio: float = 0.0

class ResourceDashboardResponse(BaseModel):
    total_assets: int = 0
    allocated_assets: int = 0
    available_assets: int = 0
    in_maintenance: int = 0
    assignment_rate: float = 0.0
    category_summary: List[CategoryInventorySummaryItem] = []

    model_config = ConfigDict(populate_by_name=True)
