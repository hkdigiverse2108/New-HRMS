from pydantic import BaseModel, Field, ConfigDict
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

class TaskBase(BaseModel):
    title: str = Field(..., description="The title of the task")
    description: Optional[str] = None
    status: TaskStatus = Field(default=TaskStatus.TO_DO)
    priority: TaskPriority = Field(default=TaskPriority.MEDIUM)
    due_date: Optional[date] = None
    assigned_to: str = Field(..., description="Employee ID this task is assigned to")

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    due_date: Optional[date] = None
    assigned_to: Optional[str] = None

class TaskQuickAssign(BaseModel):
    title: str = Field(..., description="The title of the task")
    due_date: Optional[date] = None
    assigned_to: list[str] = Field(..., min_length=1, description="List of Employee IDs to assign the task to")

class UserDetails(BaseModel):
    employee_name: str

class TaskResponse(TaskBase):
    id: str = Field(alias="_id")
    assigned_by: str = Field(..., description="Employee ID who assigned this task")
    created_at: datetime
    updated_at: datetime
    is_deleted: bool = False
    
    # Populated fields
    assigned_to_details: Optional[UserDetails] = None
    assigned_by_details: Optional[UserDetails] = None
    
    model_config = ConfigDict(populate_by_name=True)
