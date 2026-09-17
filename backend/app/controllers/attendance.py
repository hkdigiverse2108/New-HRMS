from fastapi import APIRouter, Depends, Query, status, HTTPException
from typing import Optional, List, Dict, Any

from app.schemas.attendance import (
    PunchInRequest,
    PunchOutRequest,
    BreakRequest,
    BreakRecoveryRequest,
    PendingPunchOutResolveRequest,
    AttendanceOut,
    PendingPunchOutCheckResponse,
    EOMSummaryResponse,
    ManualAttendanceRequest
)
from app.services.attendance import AttendanceService
from app.controllers.auth import get_current_employee, RoleChecker
from app.redis.service import get_cache, set_cache, delete_cache, clear_pattern, make_list_key

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
    cache_key = f"attendance:last:{employee_id}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    res = await AttendanceService.check_pending_punch_out(employee_id)
    await set_cache(cache_key, res, ttl=30)
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
    result = await AttendanceService.resolve_pending_punch_out(
        employee_id=employee_id,
        record_id=payload.record_id,
        punch_out_time_str=payload.punch_out_time,
        date_str=payload.date
    )
    await delete_cache(f"attendance:last:{employee_id}")
    await clear_pattern("attendance:*")
    return result

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
    result = await AttendanceService.punch_in(employee_id, notes=notes)
    
    # Invalidate Redis caches
    await delete_cache(f"attendance:last:{employee_id}")
    await clear_pattern("attendance:*")
    return result

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
    result = await AttendanceService.punch_out(employee_id, notes=notes)
    
    # Invalidate Redis caches
    await delete_cache(f"attendance:last:{employee_id}")
    await clear_pattern("attendance:*")
    return result

@router.post("/break-in/{employee_id}")
async def break_in(
    employee_id: str,
    payload: Optional[BreakRequest] = None,
    current_employee: dict = Depends(get_current_employee)
):
    """Starts break for current session."""
    reason = payload.reason if payload else None
    result = await AttendanceService.break_in(employee_id, reason=reason)
    
    await delete_cache(f"attendance:last:{employee_id}")
    await clear_pattern("attendance:*")
    return result

@router.post("/break-out/{employee_id}")
async def break_out(
    employee_id: str,
    current_employee: dict = Depends(get_current_employee)
):
    """Ends current break and recalculates break duration."""
    result = await AttendanceService.break_out(employee_id)
    
    await delete_cache(f"attendance:last:{employee_id}")
    await clear_pattern("attendance:*")
    return result

@router.post("/recover-break/{employee_id}")
async def recover_break(
    employee_id: str,
    payload: BreakRecoveryRequest,
    current_employee: dict = Depends(get_current_employee)
):
    """Recovers and corrects a missed break-out by specifying break start and actual break out times."""
    return await AttendanceService.recover_break(
        employee_id=employee_id,
        date_str=payload.date,
        break_start_time_str=payload.break_start_time,
        actual_break_out_time_str=payload.actual_break_out_time
    )

@router.get("", response_model=List[AttendanceOut])
async def get_attendance_list(
    employee_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: Optional[int] = Query(None, ge=1),
    limit: Optional[int] = Query(None, ge=1),
    current_employee: dict = Depends(get_current_employee)
):
    """
    Fetch attendance records with Redis caching:
    - Admin & HR: View all records or filter.
    - Regular Employee: Restricted to their own records only.
    """
    work = current_employee.get("work_details", {})
    user_role = work.get("system_role", "Employee")
    current_id = str(current_employee.get("_id") or current_employee.get("id") or current_employee.get("email") or "")

    cache_key = make_list_key(
        "attendance",
        emp=employee_id,
        start=start_date,
        end=end_date,
        stat=status,
        page=page,
        limit=limit,
        role=user_role,
        uid=current_id
    )

    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    result = await AttendanceService.get_attendance_list(
        employee_id=employee_id,
        start_date=start_date,
        end_date=end_date,
        status=status,
        page=page,
        limit=limit,
        current_user_role=user_role,
        current_user_id=current_id
    )

    await set_cache(cache_key, result, ttl=60)
    return result

@router.get("/summary", response_model=EOMSummaryResponse)
async def get_eom_summary(
    month: str = Query(..., description="Month name (e.g. September) or index (1-12)"),
    year: int = Query(..., description="Year (e.g. 2026)"),
    employee_id: Optional[str] = Query(None),
    current_employee: dict = Depends(get_current_employee)
):
    """
    End of Month (EOM) / Payroll Summary view with Redis caching.
    """
    work = current_employee.get("work_details", {})
    user_role = work.get("system_role", "Employee")
    current_id = str(current_employee.get("_id") or current_employee.get("id") or current_employee.get("email") or "")

    cache_key = f"attendance:eom:{month}:{year}:{employee_id or 'all'}:{user_role}:{current_id}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    result = await AttendanceService.get_eom_summary(
        month=month,
        year=year,
        employee_id=employee_id,
        current_user_role=user_role,
        current_user_id=current_id
    )

    await set_cache(cache_key, result, ttl=120)
    return result

@router.post("/manual")
async def mark_manual_attendance(
    payload: ManualAttendanceRequest,
    current_employee: dict = Depends(RoleChecker(["Admin", "Subadmin", "HR"]))
):
    """
    Allows Admin or HR to manually mark attendance for a day (bulk or per employee).
    Useful when office is closed or for special events/holidays to prevent auto-penalties.
    """
    return await AttendanceService.mark_manual_attendance(
        date_str=payload.date,
        status_val=payload.status,
        employee_id=payload.employee_id,
        employee_ids=payload.employee_ids,
        check_in=payload.check_in,
        check_out=payload.check_out,
        remarks=payload.remarks
    )

