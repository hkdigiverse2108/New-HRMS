from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime

class LineItemSchema(BaseModel):
    description: str = Field("", description="Item or service description")
    sac: Optional[str] = Field(None, description="SAC / HSN code")
    quantity: float = Field(1.0, ge=0, description="Quantity")
    rate: float = Field(0.0, ge=0, description="Rate per unit")
    discount: float = Field(0.0, ge=0, description="Discount amount for item")
    amount: Optional[float] = Field(None, description="Auto-calculated amount")

class BankDetailsSchema(BaseModel):
    account_id: Optional[str] = None
    nickname: Optional[str] = None
    bank_name: Optional[str] = None
    account_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    branch: Optional[str] = None
    upi_id: Optional[str] = None

class InvoiceLogSchema(BaseModel):
    action: str = Field(..., description="Action name e.g. created, updated, approved, rejected, status_updated, access_updated")
    description: str = Field(..., description="Human readable description of activity log")
    performed_by: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class InvoiceCreate(BaseModel):
    invoice_type: str = Field("Tax Invoice", description="'Tax Invoice' or 'Proforma Invoice'")
    invoice_number: Optional[str] = Field(None, description="Auto-generated if empty (INV-001 / PINV-001)")
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    client_address: Optional[str] = None
    client_phone: Optional[str] = None
    client_gstin: Optional[str] = None
    client_department: Optional[str] = None
    state_ut: Optional[str] = Field(None, description="State / UT e.g. '24 - Gujarat'")
    mode_of_payment: Optional[str] = Field(None, description="Mode of payment")
    bank_account_id: Optional[str] = Field(None, description="ID of selected bank account")
    bank_nickname: Optional[str] = Field(None, description="Nickname of selected bank account")
    bank_details: Optional[BankDetailsSchema] = None
    issue_date: Optional[str] = None
    due_date: Optional[str] = None
    status: Optional[str] = Field(None, description="Status (auto-set based on role if omitted)")
    line_items: List[LineItemSchema] = Field(default_factory=list)
    tax_option: Optional[str] = Field(None, description="'CGST + SGST' or 'IGST'")
    cgst_rate: Optional[float] = None
    sgst_rate: Optional[float] = None
    igst_rate: Optional[float] = None
    additional_discount: float = 0.0
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    notes: Optional[str] = None
    accessible_employee_ids: Optional[List[str]] = Field(default_factory=list, description="List of employee IDs with access")

class InvoiceUpdate(BaseModel):
    invoice_type: Optional[str] = None
    invoice_number: Optional[str] = None
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    client_address: Optional[str] = None
    client_phone: Optional[str] = None
    client_gstin: Optional[str] = None
    client_department: Optional[str] = None
    state_ut: Optional[str] = None
    mode_of_payment: Optional[str] = None
    bank_account_id: Optional[str] = None
    bank_nickname: Optional[str] = None
    bank_details: Optional[BankDetailsSchema] = None
    issue_date: Optional[str] = None
    due_date: Optional[str] = None
    status: Optional[str] = None
    line_items: Optional[List[LineItemSchema]] = None
    tax_option: Optional[str] = None
    cgst_rate: Optional[float] = None
    sgst_rate: Optional[float] = None
    igst_rate: Optional[float] = None
    additional_discount: Optional[float] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    notes: Optional[str] = None
    accessible_employee_ids: Optional[List[str]] = None

class InvoiceStatusUpdate(BaseModel):
    status: str = Field(..., description="paid, unpaid, pending_approval, partially_paid, cancelled, rejected")

class InvoiceAccessUpdate(BaseModel):
    employee_ids: List[str] = Field(default_factory=list, description="List of employee IDs who have access to this invoice")

class InvoiceRejectRequest(BaseModel):
    reason: Optional[str] = Field(None, description="Reason for rejection")

class InvoiceResponse(BaseModel):
    id: str = Field(alias="_id")
    invoice_type: str
    invoice_number: str
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    client_address: Optional[str] = None
    client_phone: Optional[str] = None
    client_gstin: Optional[str] = None
    client_department: Optional[str] = None
    state_ut: Optional[str] = None
    mode_of_payment: Optional[str] = None
    bank_account_id: Optional[str] = None
    bank_nickname: Optional[str] = None
    bank_details: Optional[BankDetailsSchema] = None
    issue_date: Optional[str] = None
    due_date: Optional[str] = None
    status: str = "paid"
    approval_status: Optional[str] = None # "pending", "approved", "rejected"
    created_by: Optional[Dict[str, Any]] = None
    approved_by: Optional[Dict[str, Any]] = None
    rejection_reason: Optional[str] = None
    accessible_employee_ids: List[str] = []
    accessible_employees: Optional[List[Dict[str, Any]]] = None
    activity_logs: List[InvoiceLogSchema] = []
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
    total_tax_amount: float = 0.0
    round_off: float = 0.0
    total_due: float = 0.0
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    notes: Optional[str] = None
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True)

class BrandLedgerItem(BaseModel):
    brand: str = Field(..., description="Brand Name")
    client_id: Optional[str] = None
    invoices_count: int = 0
    total_amount: float = 0.0
    total_paid: float = 0.0
    total_pending: float = 0.0
    total_overdue: float = 0.0

class BrandLedgerOverallSummary(BaseModel):
    total_brands_count: int = 0
    total_invoices_count: int = 0
    total_amount: float = 0.0
    total_paid: float = 0.0
    total_pending: float = 0.0
    total_overdue: float = 0.0

class BrandLedgerResponse(BaseModel):
    overall_summary: BrandLedgerOverallSummary
    data: List[BrandLedgerItem] = []
    total_brands: int = 0
    page: int = 1
    limit: int = 100
    total_pages: int = 1
