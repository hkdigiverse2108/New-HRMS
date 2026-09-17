from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

class ServiceDetails(BaseModel):
    departments: list[str] = Field(default_factory=list, description="List of selected departments")

class ClientBase(BaseModel):
    contact_person_name: str = Field(..., description="Name of the contact person")
    phone_number: str = Field(..., description="Phone number")
    email_address: Optional[str] = None
    company_name: str = Field(..., description="Company name")
    address: Optional[str] = None
    state_ut: Optional[str] = None
    gstin: Optional[str] = None
    service_details: Optional[ServiceDetails] = None
    additional_notes: Optional[str] = None

class ClientCreate(ClientBase):
    pass

class ClientUpdate(BaseModel):
    contact_person_name: Optional[str] = None
    phone_number: Optional[str] = None
    email_address: Optional[str] = None
    company_name: Optional[str] = None
    address: Optional[str] = None
    state_ut: Optional[str] = None
    gstin: Optional[str] = None
    service_details: Optional[ServiceDetails] = None
    additional_notes: Optional[str] = None

class ClientStats(BaseModel):
    total_projects: int = 0
    total_budget: float = 0
    outstanding_amount: float = 0

class ClientResponse(ClientBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime
    is_deleted: bool = False
    is_archived: bool = False
    
    projects: Optional[list[dict]] = None
    client_stats: Optional[ClientStats] = None
    
    model_config = ConfigDict(populate_by_name=True)
