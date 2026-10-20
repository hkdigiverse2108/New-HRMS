from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class InvoiceServiceBase(BaseModel):
    description: str = Field(..., min_length=1, max_length=300, description="Item description shown on the invoice")
    sac: str = Field("", max_length=20, description="SAC / HSN code")
    rate: float = Field(0, ge=0, description="Rate per unit (INR)")
    discount: float = Field(0, ge=0, le=100, description="Discount in percent")
    discount_amount: float = Field(0, ge=0, description="Discount in INR for one unit")
    discount_type: Literal["percent", "amount"] = Field("amount", description="Which discount the user typed; the other is derived from the rate")


class InvoiceServiceCreate(InvoiceServiceBase):
    pass


class InvoiceServiceUpdate(BaseModel):
    description: Optional[str] = Field(None, min_length=1, max_length=300)
    sac: Optional[str] = Field(None, max_length=20)
    rate: Optional[float] = Field(None, ge=0)
    discount: Optional[float] = Field(None, ge=0, le=100)
    discount_amount: Optional[float] = Field(None, ge=0)
    discount_type: Optional[Literal["percent", "amount"]] = None


class InvoiceServiceResponse(InvoiceServiceBase):
    id: str = Field(..., alias="_id")
    amount: float = Field(0, description="Rate after discount, for one unit")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(populate_by_name=True)
