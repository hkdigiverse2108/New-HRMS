from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class RemarkBase(BaseModel):
    employee_id: str
    department: Optional[str] = None
    rating: int = Field(..., ge=0, le=5)
    show_name: bool = False
    custom_answers: Optional[dict] = None

class RemarkStats(BaseModel):
    total_employees: int
    submitted_count: int
    submission_rate_percent: float
    average_satisfaction: float

class RemarkCreate(RemarkBase):
    pass

class RemarkUpdate(BaseModel):
    employee_id: Optional[str] = None
    department: Optional[str] = None
    rating: Optional[int] = Field(None, ge=0, le=5)
    show_name: Optional[bool] = None

class RemarkResponse(RemarkBase):
    id: str = Field(alias="_id")
    submitted_by_id: Optional[str] = None
    submitted_by_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class RemarkQuestionBase(BaseModel):
    label: str
    placeholder: Optional[str] = ""
    required: bool = False

class RemarkQuestionCreate(RemarkQuestionBase):
    pass

class RemarkQuestionUpdate(BaseModel):
    label: Optional[str] = None
    placeholder: Optional[str] = None
    required: Optional[bool] = None

class RemarkQuestionResponse(RemarkQuestionBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
