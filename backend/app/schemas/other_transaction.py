from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, Literal
from datetime import datetime, date as date_cls

FlowType = Literal["inflow", "outflow"]


def _today() -> str:
    return date_cls.today().isoformat()


class OtherTransactionBase(BaseModel):
    party: str = Field(..., min_length=1, description="Client / external entity / category the entry is grouped under")
    date: str = Field(default_factory=_today, description="Transaction date YYYY-MM-DD (defaults to today)")
    type: FlowType = Field("inflow", description="'inflow' (received) or 'outflow' (paid)")
    amount: float = Field(..., gt=0)
    method: str = Field("Bank Transfer", description="Payment method, e.g. Bank Transfer, UPI, Cheque, Cash")
    bank_account_id: Optional[str] = Field(None, description="Bank account id (required unless method is Cash)")
    description: Optional[str] = None
    remarks: Optional[str] = None


class OtherTransactionCreate(OtherTransactionBase):
    @field_validator("date", mode="before")
    @classmethod
    def _default_date(cls, v):
        return v or _today()

    @field_validator("type", mode="before")
    @classmethod
    def _default_type(cls, v):
        return v or "inflow"


class OtherTransactionUpdate(BaseModel):
    party: Optional[str] = Field(None, min_length=1)
    date: Optional[str] = None
    type: Optional[FlowType] = None
    amount: Optional[float] = Field(None, gt=0)
    method: Optional[str] = None
    bank_account_id: Optional[str] = None
    description: Optional[str] = None
    remarks: Optional[str] = None


class OtherTransactionResponse(OtherTransactionBase):
    id: str = Field(alias="_id")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(populate_by_name=True)


# Bank accounts for this page only (kept separate from the ledger / invoice bank accounts)
class OtherBankAccountBase(BaseModel):
    nickname: str = Field(..., min_length=1)
    bank_name: str = Field(..., min_length=1)
    account_name: Optional[str] = None
    account_number: str = Field(..., min_length=1)
    ifsc_code: str = Field(..., min_length=1)
    branch: Optional[str] = None
    upi_id: Optional[str] = None
    opening_balance: float = 0.0


class OtherBankAccountCreate(OtherBankAccountBase):
    pass


class OtherBankAccountUpdate(BaseModel):
    nickname: Optional[str] = Field(None, min_length=1)
    bank_name: Optional[str] = Field(None, min_length=1)
    account_name: Optional[str] = None
    account_number: Optional[str] = Field(None, min_length=1)
    ifsc_code: Optional[str] = Field(None, min_length=1)
    branch: Optional[str] = None
    upi_id: Optional[str] = None
    opening_balance: Optional[float] = None


class OtherBankAccountResponse(OtherBankAccountBase):
    id: str = Field(alias="_id")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(populate_by_name=True)
