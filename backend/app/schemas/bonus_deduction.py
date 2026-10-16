from pydantic import BaseModel, Field, model_validator
from typing import Literal, Optional


class BonusDeductionCreate(BaseModel):
    type: Literal["Deduction"] = "Deduction"  # Bonus flow will be added later
    category: str = Field(..., min_length=1, description="e.g. Loan EMI, Advance Recovery")
    scope: Literal["individual", "department", "company"]
    employee_id: Optional[str] = None
    department: Optional[str] = None
    amount: float = Field(..., gt=0, description="Amount per employee")
    reason: str = Field(..., min_length=1)
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$", description="Payroll date in YYYY-MM-DD")

    @model_validator(mode="after")
    def check_target(self):
        if self.scope == "individual" and not self.employee_id:
            raise ValueError("employee_id is required for an individual entry")
        if self.scope == "department" and not self.department:
            raise ValueError("department is required for a department entry")
        return self


class BonusDeductionReject(BaseModel):
    reason: str = Field(..., min_length=1)
