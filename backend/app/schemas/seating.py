from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime

class DeskModel(BaseModel):
    desk_id: Optional[str] = Field(None, description="Desk ID e.g. desk-01")
    desk_name: Optional[str] = Field(None, description="Desk Name e.g. Table #1")
    top_seats_count: int = Field(0, ge=0, description="Count of top seats")
    bottom_seats_count: int = Field(0, ge=0, description="Count of bottom seats")
    desk_pcs: List[str] = Field(default_factory=list, description="Array of PC names e.g. ['PC #1', 'PC #2']")

class DeskCreateOrUpdate(BaseModel):
    desk_id: Optional[str] = Field(None, description="Desk ID if updating existing table")
    desk_name: Optional[str] = Field(None, description="Desk Name e.g. Table #1")
    top_seats_count: int = Field(0, ge=0, description="Count of top seats")
    bottom_seats_count: int = Field(0, ge=0, description="Count of bottom seats")
    desk_pcs: List[str] = Field(default_factory=list, description="Array of PC names e.g. ['PC #1', 'PC #2']")

class SeatAllocateRequest(BaseModel):
    desk_id: Optional[str] = Field(None, description="Desk ID e.g. desk-01")
    seat_id: Optional[str] = Field(None, description="Seat ID e.g. seat-001")
    status: str = Field("Allocated", description="Status: Available or Allocated")
    employee_id: Optional[str] = Field(None, description="Employee ID to assign seat, or null/empty to unassign")

class FloorCreate(BaseModel):
    floor_name: str = Field(..., description="Floor Name e.g. 1st Floor, Main Hall")

class FloorUpdate(BaseModel):
    floor_name: Optional[str] = None

class FloorResponse(BaseModel):
    id: str = Field(alias="_id")
    floor_name: str
    desks: List[Dict[str, Any]] = []
    allocations: List[Dict[str, Any]] = []
    total_desks: int = 0
    total_seats: int = 0
    allocated_seats: int = 0
    available_seats: int = 0
    created_by: Optional[Dict[str, Any]] = None
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True)
