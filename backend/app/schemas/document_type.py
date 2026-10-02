from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime

class DocumentTypeCreate(BaseModel):
    name: str = Field(..., description="Name of the document type (e.g. Passport, Aadhaar, Educational Degree)")
    description: Optional[str] = Field(None, description="Brief description of the document type")
    is_mandatory: bool = Field(False, description="Mark as mandatory for all employees")

class DocumentTypeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_mandatory: Optional[bool] = None

class DocumentTypeResponse(BaseModel):
    id: str = Field(alias="_id")
    name: str
    description: Optional[str] = None
    is_mandatory: bool = False
    created_by: Optional[Dict[str, Any]] = None
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True)
