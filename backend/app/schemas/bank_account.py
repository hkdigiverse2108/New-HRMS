from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

class BankAccountBase(BaseModel):
    nickname: str = Field(..., description="Nickname or label for the bank account e.g. 'HDFC Primary'")
    bank_name: str = Field(..., description="Name of the bank e.g. 'HDFC Bank'")
    account_name: Optional[str] = Field(None, description="Account holder name")
    account_number: str = Field(..., description="Bank account number")
    ifsc_code: str = Field(..., description="IFSC Code")
    branch: Optional[str] = Field(None, description="Branch name")
    upi_id: Optional[str] = Field(None, description="UPI ID (optional)")
    is_default: bool = Field(False, description="Set true if this is the default bank account")

class BankAccountCreate(BankAccountBase):
    pass

class BankAccountUpdate(BaseModel):
    nickname: Optional[str] = None
    bank_name: Optional[str] = None
    account_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    branch: Optional[str] = None
    upi_id: Optional[str] = None
    is_default: Optional[bool] = None

class BankAccountResponse(BankAccountBase):
    id: str = Field(alias="_id")
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True)
