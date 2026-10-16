from pydantic import BaseModel, Field, field_validator
from typing import List, Literal, Optional


class SalaryComponent(BaseModel):
    id: str
    name: str = Field(..., min_length=1)
    amount: float = Field(..., ge=0)
    type: Literal["earnings", "deductions"]


class SalaryRevisionCreate(BaseModel):
    components: List[SalaryComponent]
    effective_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$", description="Effective date in YYYY-MM-DD")
    reason: str = Field(..., min_length=1)
    change_type: Optional[Literal["Increase", "Decrease", "Promotion", "Correction"]] = None

    @field_validator("components")
    @classmethod
    def require_earning(cls, v: List[SalaryComponent]):
        if not any(c.type == "earnings" for c in v):
            raise ValueError("At least one earnings component is required")
        return v


class SalaryRevisionReject(BaseModel):
    reason: str = Field(..., min_length=1)
