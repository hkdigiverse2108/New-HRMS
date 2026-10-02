from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

class LetterRequestCreate(BaseModel):
    employee_id: Optional[str] = Field(None, description="Employee ID for request. If omitted, uses current logged-in employee ID.")
    document_type_id: Optional[str] = Field(None, description="Optional ID of DocumentType")
    template_id: Optional[str] = Field(None, description="DocumentTemplate ID for the letter")
    needed_by_date: str = Field(..., description="Date needed by (YYYY-MM-DD or DD-MM-YYYY)")
    reason: str = Field(..., description="Reason for requesting letter")

class LetterRequestUpdate(BaseModel):
    needed_by_date: Optional[str] = None
    reason: Optional[str] = None
    status: Optional[str] = None
    rejection_reason: Optional[str] = None

class SendDocumentRequest(BaseModel):
    generated_document_id: Optional[str] = Field(None, description="Link an existing generated document ID")
    template_id: Optional[str] = Field(None, description="Or template ID to generate fresh PDF")
    placeholder_values: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Values for template placeholders")

class RejectRequestInput(BaseModel):
    reason: Optional[str] = Field(None, description="Reason for rejection")

class LetterRequestResponse(BaseModel):
    id: str
    employee_id: str
    employee_name: str
    employee_code: Optional[str] = None
    document_type_id: Optional[str] = None
    letter_type: Optional[str] = None
    template_id: Optional[str] = None
    template_name: Optional[str] = None
    requested_date: str
    needed_by_date: str
    reason: str
    status: str  # Pending, Sent, Approved, Rejected
    generated_document_id: Optional[str] = None
    pdf_url: Optional[str] = None
    rejection_reason: Optional[str] = None
    created_at: str
    updated_at: str
    is_deleted: bool = False
