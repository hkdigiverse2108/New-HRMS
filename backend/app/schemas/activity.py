from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from enum import Enum

class ActivityAction(str, Enum):
    LOGGED_ISSUE = "Logged Issue"
    CREATED_CONTENT = "Created Content"
    UPDATED_CONTENT = "Updated Content"
    DELETED_CONTENT = "Deleted Content"

class ActivityLogBase(BaseModel):
    project_id: str = Field(..., description="The ID of the parent project")
    action: ActivityAction
    description: str
    performed_by: str = Field(..., description="Employee ID of the person who performed the action")
    timestamp: str

class ActivityLogCreate(ActivityLogBase):
    pass

class ActivityLogResponse(ActivityLogBase):
    id: str = Field(alias="_id")
    # Populated fields (employee_name, profile_photo, designation, department)
    performed_by_details: Optional[dict] = None

    model_config = ConfigDict(populate_by_name=True)
