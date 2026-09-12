from pydantic import BaseModel, Field, model_validator
from typing import Optional, List, Any

class LeaveCreateRequest(BaseModel):
    type: Optional[str] = None
    leave_type: Optional[str] = None
    start_date: str  # YYYY-MM-DD
    end_date: str  # YYYY-MM-DD
    day_type: str = "Full Day"  # Full Day, Half Day, First Half, Second Half
    duration_days: float = 1.0
    reason: str
    is_conditional: Optional[bool] = False
    remarks: Optional[str] = None
    attachment: Optional[str] = None

    @model_validator(mode="after")
    def populate_type(self):
        if not self.type and self.leave_type:
            self.type = self.leave_type
        elif not self.type:
            self.type = "Sick Leave"
        return self

class LeaveUpdateRequest(BaseModel):
    type: Optional[str] = None
    leave_type: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    day_type: Optional[str] = None
    duration_days: Optional[float] = None
    reason: Optional[str] = None
    remarks: Optional[str] = None
    attachment: Optional[str] = None

class LeaveStatusUpdateRequest(BaseModel):
    status: str  # Approved, Rejected, Pending
    rejection_reason: Optional[str] = None

class LeaveOut(BaseModel):
    id: str
    employee_id: str
    employee_name: Optional[str] = None
    avatar: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    type: str
    leave_type: Optional[str] = None
    start_date: str
    end_date: str
    day_type: str = "Full Day"
    duration_days: float = 1.0
    reason: str
    status: str = "Pending"  # Pending, Approved, Rejected
    rejection_reason: Optional[str] = None
    applied_on: str
    decided_by: Optional[str] = None
    decided_at: Optional[str] = None
    is_conditional: Optional[bool] = False
    attachment: Optional[str] = None

    @model_validator(mode="after")
    def populate_leave_type(self):
        if not self.leave_type and self.type:
            self.leave_type = self.type
        return self

