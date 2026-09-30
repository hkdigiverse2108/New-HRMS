from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.schemas.invoice import LineItemSchema

class QuotationCreate(BaseModel):
    quotation_number: Optional[str] = Field(None, description="Auto-generated if empty (QUO-001)")
    client_id: Optional[str] = None
    client_name: str = Field(..., description="Client or company name")
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    client_company: Optional[str] = None
    client_address: Optional[str] = None
    client_gstin: Optional[str] = None
    client_department: Optional[str] = None
    state_ut: Optional[str] = Field(None, description="State / UT e.g. '24 - Gujarat'")
    subject: Optional[str] = Field(None, description="Subject / Project title for quotation")
    quotation_date: Optional[str] = None
    valid_until: Optional[str] = None
    status: Optional[str] = Field("sent", description="draft, sent, accepted, declined, expired, converted")
    line_items: List[LineItemSchema] = Field(default_factory=list)
    tax_option: Optional[str] = Field(None, description="'CGST + SGST' or 'IGST'")
    cgst_rate: Optional[float] = None
    sgst_rate: Optional[float] = None
    igst_rate: Optional[float] = None
    additional_discount: float = 0.0
    shipping_charges: float = 0.0
    notes: Optional[str] = Field(None, description="Notes and terms")

class QuotationUpdate(BaseModel):
    quotation_number: Optional[str] = None
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    client_company: Optional[str] = None
    client_address: Optional[str] = None
    client_gstin: Optional[str] = None
    client_department: Optional[str] = None
    state_ut: Optional[str] = None
    subject: Optional[str] = None
    quotation_date: Optional[str] = None
    valid_until: Optional[str] = None
    status: Optional[str] = None
    line_items: Optional[List[LineItemSchema]] = None
    tax_option: Optional[str] = None
    cgst_rate: Optional[float] = None
    sgst_rate: Optional[float] = None
    igst_rate: Optional[float] = None
    additional_discount: Optional[float] = None
    shipping_charges: Optional[float] = None
    notes: Optional[str] = None

class QuotationStatusUpdate(BaseModel):
    status: str = Field(..., description="draft, sent, accepted, declined, expired, converted")

class ConvertToInvoiceRequest(BaseModel):
    invoice_type: str = Field("Tax Invoice", description="'Tax Invoice' or 'Proforma Invoice'")
    due_date: Optional[str] = None
    client_name: Optional[str] = None
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    client_company: Optional[str] = None
    client_address: Optional[str] = None
    client_gstin: Optional[str] = None
    client_department: Optional[str] = None
    state_ut: Optional[str] = None
    po_number: Optional[str] = None
    line_items: Optional[List[LineItemSchema]] = None
    tax_option: Optional[str] = None
    cgst_rate: Optional[float] = None
    sgst_rate: Optional[float] = None
    igst_rate: Optional[float] = None
    additional_discount: Optional[float] = None
    shipping_charges: Optional[float] = None
    bank_account_id: Optional[str] = None
    notes: Optional[str] = None

class QuotationResponse(BaseModel):
    id: str = Field(alias="_id")
    quotation_number: str
    client_id: Optional[str] = None
    client_name: str
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    client_company: Optional[str] = None
    client_address: Optional[str] = None
    client_gstin: Optional[str] = None
    client_department: Optional[str] = None
    state_ut: Optional[str] = None
    subject: Optional[str] = None
    quotation_date: Optional[str] = None
    valid_until: Optional[str] = None
    status: str = "sent"
    converted_invoice_id: Optional[str] = None
    converted_invoice_number: Optional[str] = None
    created_by: Optional[Dict[str, Any]] = None
    line_items: List[LineItemSchema] = []
    total_before_tax: float = 0.0
    tax_option: str = "CGST + SGST"
    cgst_rate: float = 9.0
    cgst_amount: float = 0.0
    sgst_rate: float = 9.0
    sgst_amount: float = 0.0
    igst_rate: float = 0.0
    igst_amount: float = 0.0
    additional_discount: float = 0.0
    shipping_charges: float = 0.0
    total_tax_amount: float = 0.0
    round_off: float = 0.0
    total_amount: float = 0.0
    notes: Optional[str] = None
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True)

class KPICardItem(BaseModel):
    count: int = 0
    total_amount: float = 0.0

class QuotationKPIResponse(BaseModel):
    timeline: str = "all"
    total_quotations: KPICardItem
    accepted_converted: KPICardItem
    upcoming_active: KPICardItem
    overdue_expired: KPICardItem
    cancelled_declined: KPICardItem
    status_breakdown: Dict[str, KPICardItem]
