from pydantic import BaseModel, Field
from typing import Optional, List, Any, Union
from datetime import datetime

class FollowUp(BaseModel):
    date: Optional[str] = None
    note: str
    performed_by: Optional[str] = None
    user_name: Optional[str] = None
    next_follow_up_date: Optional[str] = None
    nextFollowUpDate: Optional[str] = None

class LeadBase(BaseModel):
    company: Optional[str] = ""
    contact: Optional[str] = ""
    email: Optional[str] = None
    phone: Optional[str] = None
    expected_income: Optional[Union[str, float]] = None
    expectedIncome: Optional[Union[str, float]] = None
    status: Optional[str] = "Lead"  # "Lead", "Contacted", "Proposal Sent", "Client Won", "Client Lost", "On Hold"
    priority: Optional[str] = "Medium"  # "Low", "Medium", "High"
    source: Optional[str] = "Website"
    date: Optional[str] = None
    remarks: Optional[str] = None
    closed_date: Optional[str] = None
    closedDate: Optional[str] = None
    assigned_to: Optional[Any] = []
    assignedTo: Optional[Any] = []
    follow_ups: Optional[List[FollowUp]] = []
    followUps: Optional[List[FollowUp]] = []
    is_hot: Optional[bool] = False
    isHot: Optional[bool] = False
    hold_resume_date: Optional[str] = None
    holdResumeDate: Optional[str] = None
    next_follow_up_date: Optional[str] = None
    nextFollowUpDate: Optional[str] = None
    category: Optional[str] = "General"
    city: Optional[str] = None
    created_by: Optional[str] = None
    created_by_user_name: Optional[str] = None
    createdByUserName: Optional[str] = None

class LeadCreate(LeadBase):
    performed_by: Optional[str] = None
    user_name: Optional[str] = None

class LeadUpdate(BaseModel):
    company: Optional[str] = None
    contact: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    expected_income: Optional[Union[str, float]] = None
    expectedIncome: Optional[Union[str, float]] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    source: Optional[str] = None
    date: Optional[str] = None
    remarks: Optional[str] = None
    closed_date: Optional[str] = None
    closedDate: Optional[str] = None
    assigned_to: Optional[Any] = None
    assignedTo: Optional[Any] = None
    is_hot: Optional[bool] = None
    isHot: Optional[bool] = None
    hold_resume_date: Optional[str] = None
    holdResumeDate: Optional[str] = None
    next_follow_up_date: Optional[str] = None
    nextFollowUpDate: Optional[str] = None
    category: Optional[str] = None
    city: Optional[str] = None
    reason: Optional[str] = None
    performed_by: Optional[str] = None
    user_name: Optional[str] = None

class BulkAssignLeads(BaseModel):
    lead_ids: Optional[List[str]] = Field(default_factory=list, alias="leadIds")
    assigned_to: Optional[Any] = Field(default=None, alias="assignedTo")
    performed_by: Optional[str] = Field(default=None, alias="performedBy")
    user_name: Optional[str] = Field(default=None, alias="userName")

    class Config:
        populate_by_name = True

class BulkDeleteLeads(BaseModel):
    lead_ids: Optional[List[str]] = Field(default_factory=list, alias="leadIds")

    class Config:
        populate_by_name = True

class LeadOut(LeadBase):
    id: str

class SalesTargetBase(BaseModel):
    employee_id: str = Field(alias="employeeId")
    employee_name: Optional[str] = Field(default=None, alias="employeeName")
    type: str = "Monthly"  # "Monthly", "Weekly"
    month: Optional[str] = None
    year: Optional[int] = None
    week: Optional[int] = None
    start_date: Optional[str] = Field(default=None, alias="startDate")
    end_date: Optional[str] = Field(default=None, alias="endDate")
    target_amount: float = Field(default=0.0, alias="targetAmount")
    achieved_amount: float = Field(default=0.0, alias="achievedAmount")
    category: Optional[str] = "Overall"

    class Config:
        populate_by_name = True

class SalesTargetCreate(SalesTargetBase):
    pass

class SalesTargetUpdate(BaseModel):
    target_amount: Optional[float] = Field(default=None, alias="targetAmount")
    achieved_amount: Optional[float] = Field(default=None, alias="achievedAmount")
    category: Optional[str] = None

    class Config:
        populate_by_name = True

class SalesTargetOut(SalesTargetBase):
    id: str
