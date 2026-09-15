from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date

# --- Penalty Type Schemas ---
class PenaltyTypeBase(BaseModel):
    name: str = Field(..., description="Name of the penalty, e.g., 'Late Arrival'")
    default_price: float = Field(0.0, description="Default price for this penalty type")
    warning_limit: int = Field(0, description="Number of times this acts as a warning before converting to a penalty")
    description: Optional[str] = None

class PenaltyTypeCreate(PenaltyTypeBase):
    pass

class PenaltyTypeUpdate(BaseModel):
    name: Optional[str] = None
    default_price: Optional[float] = None
    warning_limit: Optional[int] = None
    description: Optional[str] = None

class PenaltyTypeResponse(PenaltyTypeBase):
    id: str = Field(alias="_id")
    
# --- Employee Penalty Schemas ---
class EmployeePenaltyBase(BaseModel):
    employee_id: str
    penalty_type_id: str
    reason: Optional[str] = None
    penalty_date: Optional[date] = Field(None, description="The date the penalty occurred (YYYY-MM-DD). Defaults to current date if not provided.")

class EmployeePenaltyCreate(EmployeePenaltyBase):
    pass

class EmployeePenaltyUpdate(BaseModel):
    penalty_type_id: Optional[str] = None
    reason: Optional[str] = None
    penalty_date: Optional[date] = None

class EmployeePenaltyResponse(EmployeePenaltyBase):
    id: str = Field(alias="_id")
    price: float
    is_warning: bool
    is_deleted: bool = False
    created_at: datetime
    employee_name: Optional[str] = None
    avatar: Optional[str] = None
    penalty_type_name: Optional[str] = None
