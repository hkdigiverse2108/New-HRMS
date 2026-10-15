from typing import Optional
from fastapi import APIRouter, Depends, Query
from app.schemas.bonus_deduction import BonusDeductionCreate, BonusDeductionReject
from app.services.bonus_deduction import BonusDeductionService
from app.controllers.auth import RoleChecker
from app.controllers.settings import check_admin_role

router = APIRouter(prefix="/payroll/bonus-deductions", tags=["Bonus & Deductions"])

# Admin / HR (and anyone granted the Bonus & Deductions module) can view and propose entries
bd_manager = RoleChecker(["Admin", "Subadmin", "HR"], module_url="/payroll/bonuses")


@router.get("")
async def list_bonus_deductions(
    month: Optional[str] = Query(None, description="Payroll month in YYYY-MM (defaults to current month)"),
    current_user: dict = Depends(bd_manager)
):
    return await BonusDeductionService.list_entries(month)


@router.post("", status_code=201)
async def create_bonus_deduction(data: BonusDeductionCreate, current_user: dict = Depends(bd_manager)):
    return await BonusDeductionService.create(data, current_user)


@router.post("/penalties/{penalty_id}/apply")
async def apply_penalty(penalty_id: str, current_user: dict = Depends(bd_manager)):
    check_admin_role(current_user)
    from app.controllers.penalty import invalidate_penalty_caches
    result = await BonusDeductionService.apply_penalty(penalty_id, current_user)
    await invalidate_penalty_caches()
    return result


@router.post("/{entry_id}/approve")
async def approve_bonus_deduction(entry_id: str, current_user: dict = Depends(bd_manager)):
    check_admin_role(current_user)
    return await BonusDeductionService.approve(entry_id, current_user)


@router.post("/{entry_id}/reject")
async def reject_bonus_deduction(
    entry_id: str,
    data: BonusDeductionReject,
    current_user: dict = Depends(bd_manager)
):
    check_admin_role(current_user)
    return await BonusDeductionService.reject(entry_id, data.reason, current_user)
