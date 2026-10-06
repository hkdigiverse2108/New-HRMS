from pydantic import BaseModel, Field
from typing import Optional, List, Any, Union, Dict
from datetime import datetime

class FollowUp(BaseModel):
    date: Optional[str] = None
    time: Optional[str] = None
    note: str
    action_type: Optional[str] = Field(default="Call", alias="actionType")  # "Call", "Meeting", "CNR", "Call Later", "Demo", "WhatsApp"
    performed_by: Optional[str] = None
    user_name: Optional[str] = None
    next_follow_up_date: Optional[str] = None
    nextFollowUpDate: Optional[str] = None
    next_follow_up_time: Optional[str] = None
    nextFollowUpTime: Optional[str] = None

    class Config:
        populate_by_name = True

class LeadBase(BaseModel):
    company: Optional[str] = ""
    contact: Optional[str] = ""
    email: Optional[str] = None
    phone: Optional[str] = None
    expected_income: Optional[Union[str, float]] = None
    expectedIncome: Optional[Union[str, float]] = None
    status: Optional[str] = "Lead"  # "Lead", "Contacted", "Proposal Sent", "Client Won", "Client Lost", "On Hold"
    stage: Optional[str] = None
    stage_index: Optional[int] = Field(default=0, alias="stageIndex")
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
    next_follow_up_time: Optional[str] = None
    nextFollowUpTime: Optional[str] = None
    category: Optional[str] = "General"
    city: Optional[str] = None
    created_by: Optional[str] = None
    created_by_user_name: Optional[str] = None
    createdByUserName: Optional[str] = None

    # Deal conversion, quotation and incentive split fields
    deal_value: Optional[float] = Field(default=None, alias="dealValue")
    deal_note: Optional[str] = Field(default=None, alias="dealNote")
    quotation_id: Optional[str] = Field(default=None, alias="quotationId")
    quotation_title: Optional[str] = Field(default=None, alias="quotationTitle")
    quotation_value: Optional[float] = Field(default=None, alias="quotationValue")
    net_amount: Optional[float] = Field(default=None, alias="netAmount")
    gst_amount: Optional[float] = Field(default=None, alias="gstAmount")
    incentive_split: Optional[List[Dict[str, Any]]] = Field(default=None, alias="incentiveSplit")
    project_handoff_notes: Optional[str] = Field(default=None, alias="projectHandoffNotes")
    stage_history: Optional[List[Dict[str, Any]]] = Field(default=None, alias="stageHistory")

    class Config:
        populate_by_name = True

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
    stage: Optional[str] = None
    stage_index: Optional[int] = Field(default=None, alias="stageIndex")
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
    next_follow_up_time: Optional[str] = None
    nextFollowUpTime: Optional[str] = None
    category: Optional[str] = None
    city: Optional[str] = None
    reason: Optional[str] = None
    performed_by: Optional[str] = None
    user_name: Optional[str] = None

    # Deal conversion, quotation and incentive split fields
    deal_value: Optional[float] = Field(default=None, alias="dealValue")
    deal_note: Optional[str] = Field(default=None, alias="dealNote")
    quotation_id: Optional[str] = Field(default=None, alias="quotationId")
    quotation_title: Optional[str] = Field(default=None, alias="quotationTitle")
    quotation_value: Optional[float] = Field(default=None, alias="quotationValue")
    net_amount: Optional[float] = Field(default=None, alias="netAmount")
    gst_amount: Optional[float] = Field(default=None, alias="gstAmount")
    incentive_split: Optional[List[Dict[str, Any]]] = Field(default=None, alias="incentiveSplit")
    project_handoff_notes: Optional[str] = Field(default=None, alias="projectHandoffNotes")
    stage_history: Optional[List[Dict[str, Any]]] = Field(default=None, alias="stageHistory")

    class Config:
        populate_by_name = True

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

# ==============================================================================
# SALES SETTINGS & CONFIGURATION SCHEMAS
# ==============================================================================
class PipelineStageItem(BaseModel):
    name: str
    index: int = 0
    is_default: bool = False
    color: Optional[str] = "bg-primary"

class LeadCategoryItem(BaseModel):
    name: str
    icon_name: Optional[str] = Field(default="Shapes", alias="iconName")
    color: Optional[str] = "bg-primary"

class SalesSettingsUpdate(BaseModel):
    stages: Optional[List[PipelineStageItem]] = None
    categories: Optional[List[Dict[str, Any]]] = None
    sources: Optional[List[str]] = None
    assignment_rules: Optional[List[Dict[str, Any]]] = Field(default=None, alias="assignmentRules")
    eligible_owners: Optional[List[str]] = Field(default=None, alias="eligibleOwners")
    notifications: Optional[List[Dict[str, Any]]] = None
    payment_visibility: Optional[Dict[str, Any]] = Field(default=None, alias="paymentVisibility")
    follow_up_types: Optional[List[Dict[str, Any]]] = Field(default=None, alias="followUpTypes")
    role_permissions: Optional[List[Dict[str, Any]]] = Field(default=None, alias="rolePermissions")

    class Config:
        populate_by_name = True

class SalesSettingsOut(BaseModel):
    id: Optional[str] = "global_sales_settings"
    stages: List[Dict[str, Any]] = []
    categories: List[Dict[str, Any]] = []
    sources: List[str] = []
    assignment_rules: List[Dict[str, Any]] = []
    eligible_owners: List[str] = []
    notifications: List[Dict[str, Any]] = []
    payment_visibility: Dict[str, Any] = {}
    follow_up_types: List[Dict[str, Any]] = []
    role_permissions: List[Dict[str, Any]] = []

    class Config:
        populate_by_name = True

# ==============================================================================
# AUDIT LOG SCHEMAS
# ==============================================================================
class SalesAuditLogEntry(BaseModel):
    id: Optional[str] = None
    action: str
    lead_id: Optional[str] = None
    company: Optional[str] = None
    contact: Optional[str] = None
    performed_by: Optional[str] = None
    user_name: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    timestamp: Optional[datetime] = None
