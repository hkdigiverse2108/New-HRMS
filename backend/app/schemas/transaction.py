from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal
from datetime import datetime

TransactionType = Literal["credit", "debit"]
AccountType = Literal["bank", "cash"]


class TransactionBase(BaseModel):
    type: TransactionType = Field(..., description="'credit' (income/invoice) or 'debit' (expense)")
    account: AccountType = Field("cash", description="'bank' or 'cash'")
    ref_no: Optional[str] = Field(None, description="Invoice no. for credit / expense no. for debit (auto-generated for debit if empty)")
    date: str = Field(..., description="Transaction date YYYY-MM-DD")
    amount: float = Field(..., ge=0)
    category: str = "General"
    brand: Optional[str] = Field(None, description="Brand name (credit entries)")
    description: Optional[str] = None
    service: Optional[str] = None
    remarks: Optional[str] = None
    things: Optional[str] = None
    narrative: Optional[str] = None
    attachment: Optional[str] = Field(None, description="Document URL or filename")
    invoice_id: Optional[str] = Field(None, description="Linked invoice id")
    bank_account_id: Optional[str] = Field(None, description="Linked bank account id (bank entries)")


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    account: Optional[AccountType] = None
    ref_no: Optional[str] = None
    date: Optional[str] = None
    amount: Optional[float] = Field(None, ge=0)
    category: Optional[str] = None
    brand: Optional[str] = None
    description: Optional[str] = None
    service: Optional[str] = None
    remarks: Optional[str] = None
    things: Optional[str] = None
    narrative: Optional[str] = None
    attachment: Optional[str] = None
    invoice_id: Optional[str] = None
    bank_account_id: Optional[str] = None


class TransactionResponse(TransactionBase):
    id: str = Field(alias="_id")
    source: Optional[str] = "manual"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(populate_by_name=True)


class OpeningBalances(BaseModel):
    bank: float = 0.0
    cash: float = 0.0


class BankOpeningBalance(BaseModel):
    amount: float = 0.0


class OptionList(BaseModel):
    custom: List[str] = []
    hidden: List[str] = []


class OptionName(BaseModel):
    name: str = Field(..., min_length=1)
