from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime

class DocumentTemplateCreate(BaseModel):
    template_name: str = Field(..., description="Name of official document template (e.g. Appointment Letter)")
    category: str = Field("General", description="Category e.g. Onboarding, Offboarding, Agreement, General")
    content: str = Field(..., description="Rich HTML template text containing {{placeholders}}")

class DocumentTemplateUpdate(BaseModel):
    template_name: Optional[str] = None
    category: Optional[str] = None
    content: Optional[str] = None

class DocumentTemplateResponse(BaseModel):
    id: str = Field(alias="_id")
    template_name: str
    category: str = "General"
    content: str
    placeholders: List[str] = []
    created_by: Optional[Dict[str, Any]] = None
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True)
