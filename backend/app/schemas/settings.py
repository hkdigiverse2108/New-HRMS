from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime

class SettingsCreateOrUpdate(BaseModel):
    company_name: Optional[str] = Field("Harikrushn DigiVerse LLP", description="Company Name")
    company_address: Optional[str] = Field("FLAT-204, 2nd FLOOR, RS NO-67/1, WING-A, HARIKRUSHANA COMPLEX, OPP. BHAGAT NAGAR, VED, GURUKULROAD, KATARGAM, SURAT- 395004, Gujarat, INDIA...", description="Full address")
    company_phone: Optional[str] = Field("+919537150942", description="Contact phone")
    company_email: Optional[str] = Field("parthlathiya2004@gmail.com", description="Contact email")
    company_gstin: Optional[str] = Field("24AAXFN3372M1ZK", description="Company GSTIN")
    company_pan: Optional[str] = Field("AAXFN3372M", description="Company PAN")
    company_llpin: Optional[str] = Field("ACK-1143", description="LLPIN / CIN")
    company_state_code: Optional[str] = Field("24", description="State Code")
    logo_url: Optional[str] = Field(None, description="URL or relative path to company logo image")
    letterhead_url: Optional[str] = Field(None, description="URL or relative path to company letterhead header image")
    signature_url: Optional[str] = Field(None, description="URL or relative path to authorized signature image")
    signature_name: Optional[str] = Field("Authorized Signatory", description="Authorized signatory name / title")
    default_terms: Optional[str] = Field("1. Payment is due within 3 days of the invoice date.\n2. Late payments may incur additional charges.\n3. All disputes are subject to Gujarat Jurisdiction.", description="Default terms & conditions")
    default_bank_account_id: Optional[str] = Field(None, description="ID of default bank account")
    bank_name: Optional[str] = Field("Axis Bankk", description="Default Bank Name")
    account_number: Optional[str] = Field("9240200573774150", description="Default Bank Account Number")
    ifsc_code: Optional[str] = Field("UTIB00028912", description="Default Bank IFSC Code")
    account_name: Optional[str] = Field("Harikrushn DigiVerse LLP", description="Account Name")
    primary_color: Optional[str] = Field("#C08497", description="Theme Color 1 (Start) e.g. #A09D9C or #C08497")
    secondary_color: Optional[str] = Field("#B5798C", description="Theme Color 2 (End) e.g. #D59AAB or #B5798C")

class SettingsResponse(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    company_name: str = "Harikrushn DigiVerse LLP"
    company_address: str = "FLAT-204, 2nd FLOOR, RS NO-67/1, WING-A, HARIKRUSHANA COMPLEX, OPP. BHAGAT NAGAR, VED, GURUKULROAD, KATARGAM, SURAT- 395004, Gujarat, INDIA..."
    company_phone: str = "+919537150942"
    company_email: str = "parthlathiya2004@gmail.com"
    company_gstin: str = "24AAXFN3372M1ZK"
    company_pan: str = "AAXFN3372M"
    company_llpin: str = "ACK-1143"
    company_state_code: str = "24"
    logo_url: Optional[str] = None
    letterhead_url: Optional[str] = None
    signature_url: Optional[str] = None
    signature_name: str = "Authorized Signatory"
    default_terms: str = "1. Payment is due within 3 days of the invoice date.\n2. Late payments may incur additional charges.\n3. All disputes are subject to Gujarat Jurisdiction."
    default_bank_account_id: Optional[str] = None
    bank_name: str = "Axis Bankk"
    account_number: str = "9240200573774150"
    ifsc_code: str = "UTIB00028912"
    account_name: str = "Harikrushn DigiVerse LLP"
    primary_color: str = "#C08497"
    secondary_color: str = "#B5798C"
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(populate_by_name=True)

# Aliases for backward compatibility
InvoiceSettingsCreateOrUpdate = SettingsCreateOrUpdate
InvoiceSettingsResponse = SettingsResponse
