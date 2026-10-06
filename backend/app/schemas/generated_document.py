from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime

class DocumentPreviewRequest(BaseModel):
    template_id: str = Field(..., description="ID of document template selected")
    employee_id: str = Field(..., description="ID of employee selected")

class VariableItem(BaseModel):
    key: str = Field(..., description="Variable key e.g. designation")
    label: str = Field(..., description="Human readable label e.g. DESIGNATION")
    value: Optional[str] = Field("", description="Current or pre-filled value")
    auto_filled: bool = Field(False, description="Whether value was auto-filled from employee details")

class DocumentPreviewResponse(BaseModel):
    template_id: str
    template_name: str
    category: str
    employee_id: str
    employee_name: str
    employee_code: Optional[str] = None
    variables: List[VariableItem] = []
    preview_html: str

class DocumentGenerateRequest(BaseModel):
    template_id: str = Field(..., description="ID of document template selected")
    employee_id: str = Field(..., description="ID of employee selected")
    variables: Dict[str, Any] = Field(default_factory=dict, description="Key-value mapping of replaced placeholders")
    placeholder_values: Optional[Dict[str, Any]] = Field(default=None, description="Alias for variables")

class GeneratedDocumentResponse(BaseModel):
    id: str = Field(alias="_id")
    template_id: str
    template_name: str
    category: str = "General"
    employee_id: str
    employee_name: str
    employee_code: Optional[str] = None
    variables: Dict[str, Any] = {}
    rendered_content: str
    pdf_path: Optional[str] = None
    pdf_url: Optional[str] = None
    generated_by: Optional[Dict[str, Any]] = None
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True)
