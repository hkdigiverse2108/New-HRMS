from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime

class ResourceCategoryCreate(BaseModel):
    category_name: str = Field(..., description="Category Name e.g. Printer, Software License, Desk")
    total_resources: Optional[int] = Field(0, ge=0, description="Initial total resources count")
    initial_resource_count: Optional[int] = Field(None, ge=0, description="Initial count alternative")
    total_items: Optional[int] = Field(None, ge=0)
    totalItems: Optional[int] = Field(None, ge=0)
    description: Optional[str] = Field(None, description="Category Description")

class ResourceCategoryUpdate(BaseModel):
    category_name: Optional[str] = Field(None, description="Category Name")
    add_resources: Optional[int] = Field(None, ge=0, description="Number of items to add to inventory")
    remove_resources: Optional[int] = Field(None, ge=0, description="Number of items to deduct from inventory")
    description: Optional[str] = Field(None, description="Category Description")

class ResourceCategoryResponse(BaseModel):
    id: str = Field(alias="_id")
    category_name: str
    total_resources: int = 0
    total_items: int = 0
    description: Optional[str] = None
    created_by: Optional[Dict[str, Any]] = None
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True)

class ResourceCategoryPaginatedResponse(BaseModel):
    items: List[ResourceCategoryResponse]
    data: List[ResourceCategoryResponse]
    total: int
    page: int
    limit: int
    total_pages: int

    model_config = ConfigDict(populate_by_name=True)

