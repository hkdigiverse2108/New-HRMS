from fastapi import APIRouter, Depends
from app.schemas.salary import SalaryRevisionCreate, SalaryRevisionReject
from app.services.salary import SalaryService
from app.controllers.auth import RoleChecker
from app.controllers.settings import check_admin_role
from app.redis.service import get_cache, set_cache, clear_pattern

router = APIRouter(prefix="/payroll/salary", tags=["Salary Structure"])

# Admin / HR (and anyone granted the Salary Structure module) can view and propose revisions
salary_manager = RoleChecker(["Admin", "Subadmin", "HR"], module_url="/payroll/structure")


@router.get("")
async def get_salary_overview(current_user: dict = Depends(salary_manager)):
    cache_key = "salary:overview"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached
    res = await SalaryService.get_overview()
    await set_cache(cache_key, res)
    return res


@router.get("/{employee_id}")
async def get_employee_salary(employee_id: str, current_user: dict = Depends(salary_manager)):
    cache_key = f"salary:emp:{employee_id}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached
    res = await SalaryService.get_employee_detail(employee_id)
    await set_cache(cache_key, res)
    return res


@router.post("/{employee_id}/revisions", status_code=201)
async def create_salary_revision(
    employee_id: str,
    data: SalaryRevisionCreate,
    current_user: dict = Depends(salary_manager)
):
    res = await SalaryService.create_revision(employee_id, data, current_user)
    await clear_pattern("salary:*")
    await clear_pattern("payroll:*")
    return res


@router.post("/revisions/{rev_id}/approve")
async def approve_salary_revision(rev_id: str, current_user: dict = Depends(salary_manager)):
    check_admin_role(current_user)
    res = await SalaryService.approve(rev_id, current_user)
    await clear_pattern("salary:*")
    await clear_pattern("payroll:*")
    return res


@router.post("/revisions/{rev_id}/reject")
async def reject_salary_revision(
    rev_id: str,
    data: SalaryRevisionReject,
    current_user: dict = Depends(salary_manager)
):
    check_admin_role(current_user)
    res = await SalaryService.reject(rev_id, data.reason, current_user)
    await clear_pattern("salary:*")
    return res
