from pydantic import BaseModel, Field
from typing import Optional, Literal


class OvertimeCreate(BaseModel):
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$", description="Day the overtime was worked (YYYY-MM-DD)")
    hours: float = Field(..., gt=0, le=16, description="Overtime hours worked beyond the standard day")
    reason: str = Field(..., min_length=3, max_length=500)


class OvertimeStatusUpdate(BaseModel):
    status: Literal["Approved", "Rejected"]
    note: Optional[str] = Field(None, max_length=500)
    # Approver may change the hours before approving; the approved hours are what payroll pays
    hours: Optional[float] = Field(None, gt=0, le=16)


class OvertimeUpdate(BaseModel):
    """Admin / HR correction of a request (any status); approved hours flow into payroll."""
    hours: Optional[float] = Field(None, gt=0, le=16)
    reason: Optional[str] = Field(None, min_length=3, max_length=500)
