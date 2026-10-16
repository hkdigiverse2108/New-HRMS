from typing import Optional
from fastapi import APIRouter, Depends, Query

from app.controllers.auth import get_current_employee
from app.schemas.overtime import OvertimeCreate, OvertimeStatusUpdate, OvertimeUpdate
from app.services.overtime import OvertimeService
from app.services.salary import _today

router = APIRouter(prefix="/overtime", tags=["Overtime"])


@router.get("")
async def list_overtime(
    scope: str = Query("mine", description="'mine' or 'all' (Admin / HR only)"),
    status: Optional[str] = Query(None, description="Pending / Approved / Rejected"),
    month: Optional[str] = Query(None, description="YYYY-MM"),
    current_user: dict = Depends(get_current_employee),
):
    return await OvertimeService.list_for(current_user, scope, status, month)


@router.get("/worked-hours")
async def get_worked_hours(
    date: Optional[str] = Query(None, description="YYYY-MM-DD (defaults to today)"),
    current_user: dict = Depends(get_current_employee),
):
    """Hours worked that day and the OT beyond the standard hours — pre-fills the request form."""
    return await OvertimeService.worked_hours(str(current_user.get("_id", "")), date or _today())


@router.post("")
async def request_overtime(payload: OvertimeCreate, current_user: dict = Depends(get_current_employee)):
    return await OvertimeService.create(current_user, payload)


@router.patch("/{request_id}/status")
async def decide_overtime(request_id: str, payload: OvertimeStatusUpdate, current_user: dict = Depends(get_current_employee)):
    return await OvertimeService.decide(request_id, payload, current_user)


@router.put("/{request_id}")
async def edit_overtime(request_id: str, payload: OvertimeUpdate, current_user: dict = Depends(get_current_employee)):
    """Admin / HR only — employees cannot edit their requests."""
    return await OvertimeService.edit(request_id, payload, current_user)


@router.delete("/{request_id}")
async def cancel_overtime(request_id: str, current_user: dict = Depends(get_current_employee)):
    return await OvertimeService.cancel(request_id, current_user)
