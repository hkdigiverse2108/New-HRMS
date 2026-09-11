from fastapi import APIRouter, Depends, Query, status, HTTPException
from typing import Optional, List, Dict, Any

from app.schemas.attendance import (
    PunchInRequest,
    PunchOutRequest,
    BreakRequest,
    PendingPunchOutResolveRequest,
    AttendanceOut,
    PendingPunchOutCheckResponse,
    EOMSummaryResponse
)
from app.services.attendance import AttendanceService
from app.controllers.auth import get_current_employee, RoleChecker

router = APIRouter(prefix="/attendance", tags=["Attendance"])

@router.get("/last/{employee_id}", response_model=PendingPunchOutCheckResponse)
async def check_pending_punch_out(
    employee_id: str,
    current_employee: dict = Depends(get_current_employee)
):
    """
    Checks if employee has an open/pending session from a past date.
    Used before allowing a new Punch-In on dashboard and right before Punch-In action.
    """
    res = await AttendanceService.check_pending_punch_out(employee_id)
    return res

@router.post("/resolve-pending-punch-out/{employee_id}")
async def resolve_pending_punch_out(
    employee_id: str,
    payload: PendingPunchOutResolveRequest,
    current_employee: dict = Depends(get_current_employee)
):
    """
    Resolves an unclosed session from a past date.
    Strictly enforces that selected punch-out time is after punch-in time!
    """
    return await AttendanceService.resolve_pending_punch_out(
        employee_id=employee_id,
        record_id=payload.record_id,
        punch_out_time_str=payload.punch_out_time,
        date_str=payload.date
    )

@router.post("/punch-in/{employee_id}")
async def punch_in(
    employee_id: str,
    payload: Optional[PunchInRequest] = None,
    current_employee: dict = Depends(get_current_employee)
):
    """
    Direct Punch-In action.
    - Admin is prevented from punching in for themselves.
    - Blocks if prior pending punch-out exists.
    - Applies late detection and half-day leave check.
    - TODO: Future activity/task selection integration will plug in here.
    """
    work = current_employee.get("work_details", {})
    system_role = work.get("system_role", "Employee")
    current_id = str(current_employee.get("_id") or current_employee.get("id") or "")

    # Admin never marks attendance for self
    if system_role == "Admin" and (employee_id == current_id or employee_id == current_employee.get("email")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin cannot mark attendance for themselves."
        )

    notes = payload.notes if payload else None
    return await AttendanceService.punch_in(employee_id, notes=notes)

@router.post("/punch-out/{employee_id}")
async def punch_out(
    employee_id: str,
    payload: Optional[PunchOutRequest] = None,
    current_employee: dict = Depends(get_current_employee)
):
    """
    Punch-Out action.
    Closes active punch, auto-closes any open break, calculates Gross - Break = Net work hours.
    """
    notes = payload.notes if payload else None
    return await AttendanceService.punch_out(employee_id, notes=notes)

@router.post("/break-in/{employee_id}")
async def break_in(
    employee_id: str,
    payload: Optional[BreakRequest] = None,
    current_employee: dict = Depends(get_current_employee)
):
    """Starts break for current session."""
    reason = payload.reason if payload else None
    return await AttendanceService.break_in(employee_id, reason=reason)

@router.post("/break-out/{employee_id}")
async def break_out(
    employee_id: str,
    current_employee: dict = Depends(get_current_employee)
):
    """Ends current break and recalculates break duration."""
    return await AttendanceService.break_out(employee_id)

@router.get("", response_model=List[AttendanceOut])
async def get_attendance_list(
    employee_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    current_employee: dict = Depends(get_current_employee)
):
    """
    Fetch attendance records with role scoping:
    - Admin & HR: View all records or filter.
    - Regular Employee: Restricted to their own records only.
    """
    work = current_employee.get("work_details", {})
    user_role = work.get("system_role", "Employee")
    current_id = str(current_employee.get("_id") or current_employee.get("id") or current_employee.get("email") or "")

    return await AttendanceService.get_attendance_list(
        employee_id=employee_id,
        start_date=start_date,
        end_date=end_date,
        status=status,
        current_user_role=user_role,
        current_user_id=current_id
    )

@router.get("/summary", response_model=EOMSummaryResponse)
async def get_eom_summary(
    month: str = Query(..., description="Month name (e.g. September) or index (1-12)"),
    year: int = Query(..., description="Year (e.g. 2026)"),
    employee_id: Optional[str] = Query(None),
    current_employee: dict = Depends(get_current_employee)
):
    """
    End of Month (EOM) / Payroll Summary view.
    Calculates Working Days, Present Days, Paid Leave, LOP, and Performance Score (out of 15).
    """
    work = current_employee.get("work_details", {})
    user_role = work.get("system_role", "Employee")
    current_id = str(current_employee.get("_id") or current_employee.get("id") or current_employee.get("email") or "")

    return await AttendanceService.get_eom_summary(
        month=month,
        year=year,
        employee_id=employee_id,
        current_user_role=user_role,
        current_user_id=current_id
    )
