from pydantic import BaseModel, Field
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
    remarks: Optional[str] = None

class DailyProgressResponse(DailyProgressBase):
    id: str = Field(alias="_id")
    employee_id: str
    employee_name: str
    department: str
    status: str = "PENDING" # PENDING, VERIFIED, REJECTED
    rating: float = 0.0
    remarks: Optional[str] = None
    verified_by_id: Optional[str] = None
    submitted_at: datetime
    verified_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class DailyProgressStats(BaseModel):
    total_reports: int
    pending_verification: int
    average_rating: float
