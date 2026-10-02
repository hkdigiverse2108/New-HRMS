from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime

class SubmittedDocumentCreate(BaseModel):
    employee_id: str = Field(..., description="Employee ID document belongs to")
    document_type_id: str = Field(..., description="Document Type ID")
    date: Optional[str] = Field(None, description="Submission/record date DD-MM-YYYY or YYYY-MM-DD")
    status: Optional[str] = Field("Accepted", description="Pending, Accepted, Rejected, Returned to Employee")

class SubmittedDocumentUpdate(BaseModel):
    document_type_id: Optional[str] = None
    date: Optional[str] = Field(None, description="Document submission/record date")
    status: Optional[str] = Field(None, description="Pending, Accepted, Rejected, Returned to Employee")

class SubmittedDocumentResponse(BaseModel):
    id: str = Field(alias="_id")
    employee_id: str
    employee_name: str
    employee_code: Optional[str] = None
    document_type_id: str
    document_type_name: str
    date: Optional[str] = None
    status: str = "Accepted"
    uploaded_by: Optional[Dict[str, Any]] = None
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True)
