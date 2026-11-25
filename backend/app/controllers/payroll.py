from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.schemas.payroll import PayrollSettingsUpdate, PayrollRowStatusUpdate, PayslipUpdate
from app.repository.payroll import PayrollRepository
from app.services.payroll import PayrollService
from app.services.payslip import PayslipService
from app.services.payroll_dashboard import PayrollDashboardService
from app.services.salary import _today
from app.controllers.auth import get_current_employee, RoleChecker, resolve_effective_permissions_for_employee
from app.controllers.settings import check_admin_role
from app.redis.service import get_cache, set_cache, clear_pattern, make_list_key

router = APIRouter(prefix="/payroll", tags=["Payroll"])

# Admin / HR (and anyone granted the Payroll Processing module) can preview and generate payroll
payroll_manager = RoleChecker(["Admin", "Subadmin", "HR"], module_url="/payroll/processing")


async def _can_view_all_payslips(user: dict) -> bool:
    """Admin / Subadmin / HR (or anyone granted Payroll Processing) sees every payslip; others only their own.

    Checked explicitly rather than with RoleChecker, which would also match the request path and let anyone
    granted the Payslips page read everyone's salary.
    """
    work = user.get("work_details") or {}
    role = str(work.get("system_role") or user.get("system_role") or "").strip().lower()
    if role in ("admin", "subadmin", "sub-admin", "hr") or str(work.get("department") or "").strip().lower() == "hr":
        return True
    perms = await resolve_effective_permissions_for_employee(user) or {}
    p = perms.get("/payroll/processing") or {}
    return bool(p.get("all") or p.get("read"))


@router.get("/dashboard")
async def get_payroll_dashboard(
    month: Optional[str] = Query(None, description="YYYY-MM (defaults to current month)"),
    current_user: dict = Depends(payroll_manager)
):
    target_month = month or _today()[:7]
    cache_key = make_list_key("payroll_dashboard", month=target_month)
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached
    res = await PayrollDashboardService.get(target_month)
    await set_cache(cache_key, res, ttl=120)
    return res


@router.get("/audit-log")
async def get_payroll_audit_log(current_user: dict = Depends(payroll_manager)):
    """Every payroll event, newest first — the dashboard shows only the latest few."""
    cache_key = "payroll:audit_log"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached
    res = await PayrollDashboardService._audit_log(limit=None)
    await set_cache(cache_key, res, ttl=120)
    return res


@router.get("/payslips")
async def list_payslips(
    month: Optional[str] = Query(None, description="YYYY-MM (defaults to the latest month with payslips)"),
    employee_id: Optional[str] = Query(None, description="Admin / HR only: one employee's payslip"),
    current_user: dict = Depends(get_current_employee)
):
    can_view_all = await _can_view_all_payslips(current_user)
    uid = str(current_user.get("_id") or current_user.get("id") or "")
    cache_key = make_list_key("payroll_payslips", scope=("all" if can_view_all else uid), month=month, employee_id=employee_id)
    cached = await get_cache(cache_key)
    if cached is not None:
        return {**cached, "can_edit": await _can_edit_payslips(current_user)}
    data = await PayslipService.list_for(current_user, can_view_all, month, employee_id)
    await set_cache(cache_key, data)
    return {**data, "can_edit": await _can_edit_payslips(current_user)}


async def _can_edit_payslips(user: dict) -> bool:
    """Admin, or anyone given Update on the Payslips module in Access Control."""
    work = user.get("work_details") or {}
    if str(work.get("system_role") or user.get("system_role") or "").strip().lower() == "admin":
        return True
    perms = await resolve_effective_permissions_for_employee(user) or {}
    p = perms.get("/payroll/payslips") or {}
    return bool(p.get("all") or p.get("update"))


@router.put("/payslips/{payslip_id}")
async def update_payslip(
    payslip_id: str,
    payload: PayslipUpdate,
    current_user: dict = Depends(get_current_employee)
):
    if not await _can_edit_payslips(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to edit payslips")
    can_view_all = await _can_view_all_payslips(current_user)
    res = await PayslipService.update(payslip_id, payload, current_user, can_view_all)
    await clear_pattern("payroll*")
    return res


@router.post("/payslips/{payslip_id}/email")
async def email_payslip(payslip_id: str, current_user: dict = Depends(get_current_employee)):
    """Email the payslip PDF to the employee — Admin / HR only."""
    can_view_all = await _can_view_all_payslips(current_user)
    if not can_view_all:  # Admin / HR send payslips; employees only view and download their own
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Admin or HR can email payslips")
    res = await PayslipService.send_email(payslip_id, current_user, can_view_all)
    await clear_pattern("payroll*")
    return res


@router.get("/settings")
async def get_payroll_settings(current_user: dict = Depends(get_current_employee)):
    cache_key = "payroll:settings"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached
    res = await PayrollRepository.get_settings()
    await set_cache(cache_key, res)
    return res


@router.put("/settings")
async def update_payroll_settings(
    data: PayrollSettingsUpdate,
    current_user: dict = Depends(get_current_employee)
):
    check_admin_role(current_user)
    res = await PayrollRepository.save_or_update_settings(data.model_dump(exclude_none=True))
    await clear_pattern("payroll*")
    return res


@router.get("/processing")
async def get_payroll_run(
    month: Optional[str] = Query(None, description="Payroll month in YYYY-MM (defaults to current month)"),
    current_user: dict = Depends(payroll_manager)
):
    target_month = month or _today()[:7]
    cache_key = make_list_key("payroll_run", month=target_month)
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached
    res = await PayrollService.get_run(target_month)
    await set_cache(cache_key, res, ttl=120)
    return res


@router.post("/processing/{month}/generate")
async def generate_payroll(month: str, current_user: dict = Depends(payroll_manager)):
    res = await PayrollService.generate(month, current_user)
    await clear_pattern("payroll*")
    return res


@router.patch("/processing/{month}/rows/{employee_id}/status")
async def update_payroll_row_status(
    month: str,
    employee_id: str,
    data: PayrollRowStatusUpdate,
    current_user: dict = Depends(payroll_manager)
):
    res = await PayrollService.set_row_status(month, employee_id, data.status, data.note, current_user)
    await clear_pattern("payroll*")
    return res


@router.post("/processing/{month}/approve")
async def approve_payroll(month: str, current_user: dict = Depends(payroll_manager)):
    check_admin_role(current_user)
    res = await PayrollService.approve(month, current_user)
    await clear_pattern("payroll*")
    return res


@router.post("/processing/{month}/lock")
async def lock_payroll(month: str, current_user: dict = Depends(payroll_manager)):
    check_admin_role(current_user)
    res = await PayrollService.lock(month, current_user)
    await clear_pattern("payroll*")
    return res


@router.post("/processing/{month}/send-payslips")
async def send_payslips(month: str, current_user: dict = Depends(payroll_manager)):
    res = await PayrollService.send_payslips(month, current_user)
    await clear_pattern("payroll*")
    return res
