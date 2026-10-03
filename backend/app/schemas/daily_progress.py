from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime

class TaskSummary(BaseModel):
    task_id: str
    title: str
    status: str

class ProgressLog(BaseModel):
    action: str
    performed_by_id: str
    performed_by_name: str
    timestamp: datetime
    details: Optional[str] = None

class DailyProgressBase(BaseModel):
    assigned_tasks: List[TaskSummary] = []
    pending_tasks: List[TaskSummary] = []
    upcoming_tasks: List[TaskSummary] = []
    completed_today_tasks: List[TaskSummary] = []
    activity_logs: List[ProgressLog] = []

class DailyProgressCreate(BaseModel):
    pass

class DailyProgressUpdate(BaseModel):
    pass

class DailyProgressApprove(BaseModel):
    rating: float = Field(..., ge=1, le=10)
    remarks: str = Field(..., min_length=1)

class DailyProgressResponse(DailyProgressBase):
    id: str = Field(alias="_id")
    employee_id: str
    employee_name: Optional[str] = "Employee"
    department: Optional[str] = "General"
    status: str = "Pending" # PENDING, VERIFIED, REJECTED
    rating: float = 0.0
    remarks: Optional[str] = None
    verified_by_id: Optional[str] = None
    submitted_at: datetime
    verified_at: Optional[datetime] = None
    on_leave: bool = False

    @field_validator('department', mode='before')
    @classmethod
    def format_department(cls, v):
        if not v:
            return "General"
        return str(v)

    @field_validator('employee_name', mode='before')
    @classmethod
    def format_employee_name(cls, v):
        if not v:
            return "Employee"
        return str(v)

    @field_validator('status', mode='before')
    @classmethod
    def format_status(cls, v: str) -> str:
        if isinstance(v, str):
            return v.title()
        return v

    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class DailyProgressStats(BaseModel):
    total_reports: int
    pending_verification: int
    average_rating: float
