from typing import Optional
from fastapi import APIRouter, Depends, Query

from app.controllers.auth import get_current_employee
from app.schemas.overtime import OvertimeCreate, OvertimeStatusUpdate, OvertimeUpdate
from app.services.overtime import OvertimeService
from app.services.salary import _today
from app.redis.service import get_cache, set_cache, clear_pattern, make_list_key

router = APIRouter(prefix="/overtime", tags=["Overtime"])


@router.get("")
async def list_overtime(
    scope: str = Query("mine", description="'mine' or 'all' (Admin / HR only)"),
    status: Optional[str] = Query(None, description="Pending / Approved / Rejected"),
    month: Optional[str] = Query(None, description="YYYY-MM"),
    current_user: dict = Depends(get_current_employee),
):
    emp_scope = "all" if scope == "all" else str(current_user.get("_id", ""))
    cache_key = make_list_key("overtime", emp_scope=emp_scope, scope=scope, status=status, month=month)
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached
    res = await OvertimeService.list_for(current_user, scope, status, month)
    await set_cache(cache_key, res)
    return res


@router.get("/worked-hours")
async def get_worked_hours(
    date: Optional[str] = Query(None, description="YYYY-MM-DD (defaults to today)"),
    current_user: dict = Depends(get_current_employee),
):
    """Hours worked that day and the OT beyond the standard hours — pre-fills the request form."""
    target_date = date or _today()
    emp_id = str(current_user.get("_id", ""))
    cache_key = make_list_key("overtime_worked", emp_id=emp_id, date=target_date)
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached
    res = await OvertimeService.worked_hours(emp_id, target_date)
    await set_cache(cache_key, res, ttl=60)
    return res


@router.post("")
async def request_overtime(payload: OvertimeCreate, current_user: dict = Depends(get_current_employee)):
    res = await OvertimeService.create(current_user, payload)
    await clear_pattern("overtime:*")
    await clear_pattern("overtime_worked:*")
    await clear_pattern("payroll:*")
    return res


@router.patch("/{request_id}/status")
async def decide_overtime(request_id: str, payload: OvertimeStatusUpdate, current_user: dict = Depends(get_current_employee)):
    res = await OvertimeService.decide(request_id, payload, current_user)
    await clear_pattern("overtime:*")
    await clear_pattern("payroll:*")
    return res


@router.put("/{request_id}")
async def edit_overtime(request_id: str, payload: OvertimeUpdate, current_user: dict = Depends(get_current_employee)):
    """Admin / HR only — employees cannot edit their requests."""
    res = await OvertimeService.edit(request_id, payload, current_user)
    await clear_pattern("overtime:*")
    await clear_pattern("payroll:*")
    return res


@router.delete("/{request_id}")
async def cancel_overtime(request_id: str, current_user: dict = Depends(get_current_employee)):
    res = await OvertimeService.cancel(request_id, current_user)
    await clear_pattern("overtime:*")
    await clear_pattern("payroll:*")
    return res
