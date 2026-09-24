from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

class ResearchConcept(BaseModel):
    concept_name: str = Field(..., description="Name of the concept")
    link: Optional[str] = Field(default=None, description="Reference link or URL")

class ResearchCreate(BaseModel):
    title: str = Field(..., description="Title of the research")
    project_id: Optional[str] = Field(default=None, description="Optional associated Project ID")
    description: Optional[str] = Field(default=None, description="Detailed research text or notes")
    concepts: list[ResearchConcept] = Field(default_factory=list, description="List of concepts and reference links")
    shared_with: list[str] = Field(default_factory=list, description="List of Employee IDs to share with")

class ResearchUpdate(BaseModel):
    title: Optional[str] = None
    project_id: Optional[str] = None
    description: Optional[str] = None
    concepts: Optional[list[ResearchConcept]] = None
    shared_with: Optional[list[str]] = None
    department_id: Optional[str] = None

class FieldChangeDetail(BaseModel):
    field: str = Field(..., description="Name of field changed (e.g. title, description, concepts)")
    old_value: Optional[str] = Field(default=None, description="Previous value before change")
    new_value: Optional[str] = Field(default=None, description="New value after change")

class ResearchHistoryLog(BaseModel):
    action: str = Field(..., description="Action type: created, updated, deleted")
    employee_id: str = Field(..., description="ID of employee who performed change")
    employee_details: Optional[dict] = Field(default=None, description="Populated employee details")
    timestamp: datetime = Field(..., description="Date and time of change")
    changes_summary: Optional[str] = Field(default=None, description="Summary of changes")
    changed_fields: list[FieldChangeDetail] = Field(default_factory=list, description="Field-level old vs new value details")

class ResearchResponse(BaseModel):
    id: str = Field(alias="_id")
    _id: Optional[str] = None
    title: str
    description: Optional[str] = None
    project_id: Optional[str] = None
    project_details: Optional[dict] = None
    concepts: list[ResearchConcept] = Field(default_factory=list)
    shared_with: list[str] = Field(default_factory=list)
    shared_with_details: Optional[list[dict]] = None
    employee_id: str
    employee_details: Optional[dict] = None
    department_id: Optional[str] = None
    department: Optional[str] = None
    can_edit: Optional[bool] = False
    can_delete: Optional[bool] = False
    history: list[ResearchHistoryLog] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)
