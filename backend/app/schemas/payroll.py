from pydantic import BaseModel, Field
from typing import Optional, List, Literal


class PayrollHoliday(BaseModel):
    id: str
    name: str = ""
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$", description="Holiday date in YYYY-MM-DD")
    type: str = "company"
    isCompanyLeave: bool = True


class PayrollRowStatusUpdate(BaseModel):
    status: Literal["pending", "verified", "on_hold"]
    note: Optional[str] = None


class PayrollSettingsUpdate(BaseModel):
    paidLeave: Optional[str] = None
    unpaidLeaveCap: Optional[str] = None
    halfDayRule: Optional[str] = None
    carryForward: Optional[bool] = None
    maxCarryForward: Optional[str] = None
    lateGrace: Optional[str] = None
    standardHours: Optional[str] = None
    enableOT: Optional[bool] = None
    otRate: Optional[str] = None
    doubleOTAfter: Optional[str] = None
    holidayOT: Optional[str] = None
    nextSalaryDate: Optional[str] = None
    holidays: List[PayrollHoliday] = Field(default_factory=list)


class PayslipLineUpdate(BaseModel):
    name: str = Field(..., min_length=1)
    amount: float = Field(..., ge=0)


class PayslipEmployeeUpdate(BaseModel):
    designation: Optional[str] = None
    joining_date: Optional[str] = None
    pan: Optional[str] = None
    bank_name: Optional[str] = None
    account: Optional[str] = None
    ifsc: Optional[str] = None


class PayslipUpdate(BaseModel):
    employee: Optional[PayslipEmployeeUpdate] = None
    present_days: Optional[float] = Field(None, ge=0)
    earnings: Optional[List[PayslipLineUpdate]] = None
    deductions: Optional[List[PayslipLineUpdate]] = None
