from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional
from datetime import date, time
from app.schemas.enums import SystemRole, GenderEnum, RelationEnum, WorkModeEnum

class PersonalInfo(BaseModel):
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    email_address: EmailStr
    phone_number: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[GenderEnum] = None
    password: str
    parent_guardian_name: Optional[str] = None
    contact_number: Optional[str] = None
    relation: Optional[RelationEnum] = None
    profile_photo: Optional[str] = None
    signature: Optional[str] = None
    signature_url: Optional[str] = None
    password_enc: Optional[str] = None  # vault copy (self-view only, never for others)

class PersonalInfoOut(PersonalInfo):
    password: str = Field(exclude=True) # Exclude password from responses
    password_enc: str = Field(default="", exclude=True) # Exclude vault copy too

class WorkDetails(BaseModel):
    system_role: SystemRole = SystemRole.EMPLOYEE
    employee_id: Optional[str] = None
    department: Optional[str] = None
    sub_department: Optional[str] = None
    designation: Optional[str] = None
    is_delete: bool = False
    is_block: bool = False
    work_mode: Optional[WorkModeEnum] = None
    joining_date: Optional[date] = None
    last_working_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None

class BankAndDocs(BaseModel):
    monthly_salary: Optional[float] = None
    upi_id: Optional[str] = None
    bank_name: Optional[str] = None
    account_holder_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    aadhar_card_number: Optional[str] = None
    pan_card_number: Optional[str] = None

class DocumentChecklist(BaseModel):
    marksheet_10th: bool = False
    marksheet_12th: bool = False
    degree_certificate: bool = False
    aadhar_card: bool = False
    pan_card: bool = False
    experience_letter: bool = False
    relieving_letter: bool = False
    payslip_3_months: bool = False
    passport_size_photo: bool = False
    bank_passbook_or_cheque: bool = False

class BondAndExit(BaseModel):
    has_active_bond: bool = False
    bond_start_date: Optional[date] = None
    bond_end_date: Optional[date] = None
    serving_notice_period: bool = False
    notice_period_days: Optional[str] = None
    notice_period_start_date: Optional[date] = None
    has_resigned: bool = False
    resignation_date: Optional[date] = None
    has_employment: bool = False
    employment_start_date: Optional[date] = None
    contract_status: Optional[str] = "Verified"

class DepositDetails(BaseModel):
    deposit_type: Optional[str] = "Employee"  # "Intern" (₹2,000) or "Employee" (₹10,000)
    deposit_amount: Optional[float] = 10000.0
    amount_paid: Optional[float] = 0.0
    status: Optional[str] = "Pending"  # "Pending", "Partial", "Paid", "Refunded"
    payment_date: Optional[date] = None
    payment_mode: Optional[str] = None  # "Cash", "UPI", "Bank Transfer", "Cheque"
    remarks: Optional[str] = None

class EmployeeCreate(BaseModel):
    employee_id: Optional[str] = None
    personal_info: PersonalInfo
    work_details: WorkDetails
    bank_and_docs: Optional[BankAndDocs] = BankAndDocs()
    document_checklist: Optional[DocumentChecklist] = DocumentChecklist()
    bond_and_exit: Optional[BondAndExit] = BondAndExit()
    deposit_details: Optional[DepositDetails] = DepositDetails()
    profile_photo: Optional[str] = None
    signature: Optional[str] = None
    signature_url: Optional[str] = None

class PersonalInfoUpdate(BaseModel):
    """Partial personal info for updates — all optional so blank password can be omitted."""
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    email_address: Optional[EmailStr] = None
    phone_number: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[GenderEnum] = None
    password: Optional[str] = None
    parent_guardian_name: Optional[str] = None
    contact_number: Optional[str] = None
    relation: Optional[RelationEnum] = None
    profile_photo: Optional[str] = None
    signature: Optional[str] = None
    signature_url: Optional[str] = None

class PersonalInfoSelfOut(PersonalInfoOut):
    """Self view — decrypted password included ONLY for own record."""
    password: Optional[str] = None  # type: ignore[assignment]

class EmployeeUpdate(BaseModel):
    employee_id: Optional[str] = None
    personal_info: Optional[PersonalInfoUpdate] = None
    work_details: Optional[WorkDetails] = None
    bank_and_docs: Optional[BankAndDocs] = None
    document_checklist: Optional[DocumentChecklist] = None
    bond_and_exit: Optional[BondAndExit] = None
    deposit_details: Optional[DepositDetails] = None
    profile_photo: Optional[str] = None
    signature: Optional[str] = None
    signature_url: Optional[str] = None

class EmployeeOut(BaseModel):
    id: str = Field(..., alias="_id")
    employee_id: Optional[str] = None
    personal_info: PersonalInfoOut
    work_details: WorkDetails
    bank_and_docs: Optional[BankAndDocs] = None
    document_checklist: Optional[DocumentChecklist] = None
    bond_and_exit: Optional[BondAndExit] = None
    deposit_details: Optional[DepositDetails] = None
    profile_photo: Optional[str] = None
    signature: Optional[str] = None
    signature_url: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)

class EmployeeSelfOut(EmployeeOut):
    """Single-record self view — password present only for own record."""
    personal_info: PersonalInfoSelfOut  # type: ignore[assignment]
