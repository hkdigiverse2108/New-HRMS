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
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)
