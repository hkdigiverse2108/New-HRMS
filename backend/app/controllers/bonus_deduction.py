from typing import Optional
from fastapi import APIRouter, Depends, Query
from app.schemas.bonus_deduction import BonusDeductionCreate, BonusDeductionReject
from app.services.bonus_deduction import BonusDeductionService
from app.controllers.auth import RoleChecker
from app.controllers.settings import check_admin_role
from app.redis.service import get_cache, set_cache, clear_pattern, make_list_key

router = APIRouter(prefix="/payroll/bonus-deductions", tags=["Bonus & Deductions"])

# Admin / HR (and anyone granted the Bonus & Deductions module) can view and propose entries
bd_manager = RoleChecker(["Admin", "Subadmin", "HR"], module_url="/payroll/bonuses")


@router.get("")
async def list_bonus_deductions(
    month: Optional[str] = Query(None, description="Payroll month in YYYY-MM (defaults to current month)"),
    current_user: dict = Depends(bd_manager)
):
    cache_key = make_list_key("bonus_deductions", month=month)
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached
    res = await BonusDeductionService.list_entries(month)
    await set_cache(cache_key, res)
    return res


@router.post("", status_code=201)
async def create_bonus_deduction(data: BonusDeductionCreate, current_user: dict = Depends(bd_manager)):
    res = await BonusDeductionService.create(data, current_user)
    await clear_pattern("bonus_deductions:*")
    await clear_pattern("payroll:*")
    return res


@router.post("/penalties/{penalty_id}/apply")
async def apply_penalty(penalty_id: str, current_user: dict = Depends(bd_manager)):
    check_admin_role(current_user)
    from app.controllers.penalty import invalidate_penalty_caches
    result = await BonusDeductionService.apply_penalty(penalty_id, current_user)
    await invalidate_penalty_caches()
    await clear_pattern("bonus_deductions:*")
    await clear_pattern("payroll:*")
    return result


@router.post("/{entry_id}/approve")
async def approve_bonus_deduction(entry_id: str, current_user: dict = Depends(bd_manager)):
    check_admin_role(current_user)
    res = await BonusDeductionService.approve(entry_id, current_user)
    await clear_pattern("bonus_deductions:*")
    await clear_pattern("payroll:*")
    return res


@router.post("/{entry_id}/reject")
async def reject_bonus_deduction(
    entry_id: str,
    data: BonusDeductionReject,
    current_user: dict = Depends(bd_manager)
):
    check_admin_role(current_user)
    res = await BonusDeductionService.reject(entry_id, data.reason, current_user)
    await clear_pattern("bonus_deductions:*")
    await clear_pattern("payroll:*")
    return res
