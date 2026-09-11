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

class PersonalInfoOut(PersonalInfo):
    password: str = Field(exclude=True) # Exclude password from responses



class WorkDetails(BaseModel):
    system_role: SystemRole
    department: Optional[str] = None
    sub_department: Optional[str] = None
    designation: Optional[str] = None
    is_delete: bool = False
    is_block: bool = False
    work_mode: Optional[WorkModeEnum] = None
    joining_date: Optional[date] = None
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
    serving_notice_period: bool = False
    has_resigned: bool = False

class EmployeeCreate(BaseModel):
    personal_info: PersonalInfo
    work_details: WorkDetails
    bank_and_docs: Optional[BankAndDocs] = BankAndDocs()
    document_checklist: Optional[DocumentChecklist] = DocumentChecklist()
    bond_and_exit: Optional[BondAndExit] = BondAndExit()
    profile_photo: Optional[str] = None

class EmployeeUpdate(BaseModel):
    personal_info: Optional[PersonalInfo] = None
    work_details: Optional[WorkDetails] = None
    bank_and_docs: Optional[BankAndDocs] = None
    document_checklist: Optional[DocumentChecklist] = None
    bond_and_exit: Optional[BondAndExit] = None
    profile_photo: Optional[str] = None

class EmployeeOut(BaseModel):
    id: str = Field(..., alias="_id")
    personal_info: PersonalInfoOut
    work_details: WorkDetails
    bank_and_docs: Optional[BankAndDocs] = None
    document_checklist: Optional[DocumentChecklist] = None
    bond_and_exit: Optional[BondAndExit] = None
    profile_photo: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)
