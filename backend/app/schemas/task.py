from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional
from datetime import datetime, date
from enum import Enum

class TaskStatus(str, Enum):
    TO_DO = "todo"
    IN_PROGRESS = "inprogress"
    IN_REVIEW = "inreview"
    COMPLETED = "completed"

class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class UserDetails(BaseModel):
    employee_name: str

class TaskTransferRequest(BaseModel):
    requested_to: str = Field(..., description="Employee ID whom the task is being transferred to")
    requested_by: str = Field(..., description="Employee ID who is requesting the transfer")
    requested_at: datetime
    reason: Optional[str] = None
    status: str = Field(default="pending")
    requested_to_details: Optional[UserDetails] = None
    requested_by_details: Optional[UserDetails] = None

class TaskTransferHistory(BaseModel):
    from_employee: str = Field(..., description="Employee ID who transferred the task")
    to_employee: str = Field(..., description="Employee ID who received the task")
    transferred_at: datetime
    reason: Optional[str] = None
    status: str = Field(default="accepted")
    from_employee_details: Optional[UserDetails] = None
    to_employee_details: Optional[UserDetails] = None

class TransferRequestPayload(BaseModel):
    requested_to: str = Field(..., description="Employee ID to transfer the task to")
    reason: Optional[str] = None

class TaskBase(BaseModel):
    title: str = Field(..., description="The title of the task")
    description: Optional[str] = None
    status: TaskStatus = Field(default=TaskStatus.TO_DO)
    priority: TaskPriority = Field(default=TaskPriority.MEDIUM)
    due_date: Optional[date] = None
    assigned_to: str = Field(..., description="Employee ID this task is assigned to")
    
    # Optional fields for SMM Tasks
    task_category: str = Field(default="General", description="Category of the task (e.g. General, SMM)")
    content_item_id: Optional[str] = None
    project_id: Optional[str] = None
    creative_role: Optional[str] = None
    
    transfer_request: Optional[TaskTransferRequest] = None
    transfer_history: list[TaskTransferHistory] = Field(default_factory=list)
    recurrence: Optional[str] = Field(default="none", description="Recurrence frequency: none, daily, weekly, monthly")
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    review_rejected_reason: Optional[str] = None
    assigned_by: Optional[str] = Field(default=None, description="Employee ID who assigned this task")
    activity_history: list[dict] = Field(default_factory=list)
    parent_task_id: Optional[str] = None
    is_recurring_instance: Optional[bool] = False

    @field_validator('status', mode='before')
    @classmethod
    def parse_status(cls, v):
        if isinstance(v, str):
            clean = v.lower().replace(" ", "").replace("_", "")
            if clean in ["todo", "notstarted"]:
                return TaskStatus.TO_DO
            if clean in ["inprogress"]:
                return TaskStatus.IN_PROGRESS
            if clean in ["inreview", "review"]:
                return TaskStatus.IN_REVIEW
            if clean in ["completed", "done"]:
                return TaskStatus.COMPLETED
        return v
        
    @field_validator('priority', mode='before')
    @classmethod
    def parse_priority(cls, v):
        if isinstance(v, str):
            clean = v.lower().strip()
            if clean == "urgent":
                return TaskPriority.HIGH
            return clean
        return v

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    due_date: Optional[date] = None
    assigned_to: Optional[str] = None
    recurrence: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    review_rejected_reason: Optional[str] = None
    assigned_by: Optional[str] = None
    activity_history: Optional[list[dict]] = None

    @field_validator('status', mode='before')
    @classmethod
    def parse_status(cls, v):
        if isinstance(v, str):
            clean = v.lower().replace(" ", "").replace("_", "")
            if clean in ["todo", "notstarted"]:
                return TaskStatus.TO_DO
            if clean in ["inprogress"]:
                return TaskStatus.IN_PROGRESS
            if clean in ["inreview", "review"]:
                return TaskStatus.IN_REVIEW
            if clean in ["completed", "done"]:
                return TaskStatus.COMPLETED
        return v
        
    @field_validator('priority', mode='before')
    @classmethod
    def parse_priority(cls, v):
        if isinstance(v, str):
            clean = v.lower().strip()
            if clean == "urgent":
                return TaskPriority.HIGH
            return clean
        return v

class TaskQuickAssign(BaseModel):
    title: str = Field(..., description="The title of the task")
    due_date: Optional[date] = None
    assigned_to: list[str] = Field(..., min_length=1, description="List of Employee IDs to assign the task to")
    assigned_by: Optional[str] = None


class TaskResponse(TaskBase):
    id: str = Field(alias="_id")
    assigned_by: str = Field(..., description="Employee ID who assigned this task")
    created_by: Optional[str] = Field(default=None, description="Employee ID who created this task")
    created_at: datetime
    updated_at: datetime
    is_deleted: bool = False
    
    # Populated fields
    assigned_to_details: Optional[UserDetails] = None
    assigned_by_details: Optional[UserDetails] = None
    created_by_details: Optional[UserDetails] = None
    approved_by_details: Optional[UserDetails] = None
    
    project_details: Optional[dict] = None
    content_item_details: Optional[dict] = None
    
    model_config = ConfigDict(populate_by_name=True)
