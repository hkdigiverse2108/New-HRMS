from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class PunchInRequest(BaseModel):
    # TODO: Future activity/task selection integration will be connected here
    notes: Optional[str] = None

class PunchOutRequest(BaseModel):
    notes: Optional[str] = None

class BreakRequest(BaseModel):
    reason: Optional[str] = None

class BreakRecoveryRequest(BaseModel):
    date: str
    break_start_time: str
    actual_break_out_time: str

class PendingPunchOutResolveRequest(BaseModel):
    record_id: str
    date: str  # Fixed pending date (YYYY-MM-DD)
    punch_out_time: str  # Time in HH:MM or HH:MM:SS or ISO string

class BreakItem(BaseModel):
    start_time: str
    end_time: Optional[str] = None
    duration_seconds: Optional[int] = 0

class PunchItem(BaseModel):
    check_in: str
    check_out: Optional[str] = None
    duration_seconds: Optional[int] = 0

class AttendanceOut(BaseModel):
    id: str
    employee_id: str
    employee_name: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    avatar: Optional[str] = None
    date: str
    status: str
    check_in: Optional[str] = "--"
    check_out: Optional[str] = "--"
    gross_seconds: Optional[int] = 0
    break_seconds: Optional[int] = 0
    net_work_seconds: Optional[int] = 0
    work_hours: Optional[str] = "--"
    break_hours: Optional[str] = "--"
    is_late: bool = False
    late_remark: Optional[str] = None
    remarks: Optional[List[str]] = []
    punches: Optional[List[Dict[str, Any]]] = []
    breaks: Optional[List[Dict[str, Any]]] = []
    logs: Optional[List[Dict[str, Any]]] = []
    actively_using_hrms: bool = True

class PendingPunchOutCheckResponse(BaseModel):
    has_pending: bool
    pending_record: Optional[Dict[str, Any]] = None

class EOMSummaryResponse(BaseModel):
    month: str
    year: int
    working_days: int
    present_days: float
    paid_leave_days: float
    lop_days: float
    performance_score: float  # out of 15
    employee_id: Optional[str] = None
    employee_name: Optional[str] = None
