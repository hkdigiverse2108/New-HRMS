from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
import uuid

class PresetTask(BaseModel):
    preset_task_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: Optional[str] = None
    priority: str = "medium"
    estimated_hours: Optional[float] = Field(default=None, description="Estimated time in hours")

class PresetTaskGroup(BaseModel):
    group_name: str
    tasks: List[PresetTask] = []

class PresetCreate(BaseModel):
    name: str = Field(..., description="Name of the preset template")
    description: Optional[str] = None
    preset_type: str = Field("normal", description="'normal' or 'intern'")
    task_groups: List[PresetTaskGroup] = []
    assigned_interns: Optional[List[str]] = Field(default=[], description="List of employee IDs for intern presets")

class PresetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    task_groups: Optional[List[PresetTaskGroup]] = None
    assigned_interns: Optional[List[str]] = None

class PresetResponse(BaseModel):
    id: str = Field(alias="_id")
    name: str
    description: Optional[str] = None
    preset_type: str
    task_groups: List[PresetTaskGroup] = []
    assigned_interns: List[str] = []
    created_by: str
    created_at: datetime
    updated_at: datetime
    is_deleted: bool = False

    model_config = ConfigDict(populate_by_name=True)

class ApplyPresetPayload(BaseModel):
    project_id: str
