from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from app.schemas.penalty import (
    PenaltyTypeCreate, 
    PenaltyTypeUpdate, 
    PenaltyTypeResponse, 
    EmployeePenaltyCreate, 
    EmployeePenaltyUpdate, 
    EmployeePenaltyResponse,
    PenaltySummaryResponse
)
from app.schemas.pagination import PaginatedResponse
from app.services.penalty import PenaltyService
from app.controllers.auth import RoleChecker, get_current_employee
from app.redis.service import (
    get_cache, 
    set_cache, 
    delete_cache, 
    clear_pattern, 
    make_list_key
)

router = APIRouter(prefix="/penalties", tags=["Penalties"])

# Permissions
admin_hr_checker = RoleChecker(["Admin", "Subadmin", "HR"])

async def invalidate_penalty_caches():
    """Invalidate all cached penalty lists, summaries, and leaderboard data."""
    await clear_pattern("penalties:list:*")
    await delete_cache("penalties:leaderboard")
    await delete_cache("penalties:summary")

# --- Penalty Types ---
@router.post("/types", response_model=PenaltyTypeResponse, status_code=status.HTTP_201_CREATED)
async def create_penalty_type(data: PenaltyTypeCreate, current_user: dict = Depends(admin_hr_checker)):
    result = await PenaltyService.create_penalty_type(data)
    await delete_cache("penalties:types:all")
    return result

@router.get("/types", response_model=List[PenaltyTypeResponse])
async def get_penalty_types(current_user: dict = Depends(get_current_employee)):
    cache_key = "penalties:types:all"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    result = await PenaltyService.get_all_penalty_types()
    await set_cache(cache_key, result)
    return result

@router.put("/types/{item_id}", response_model=PenaltyTypeResponse)
async def update_penalty_type(item_id: str, data: PenaltyTypeUpdate, current_user: dict = Depends(admin_hr_checker)):
    result = await PenaltyService.update_penalty_type(item_id, data)
    await delete_cache("penalties:types:all")
    await delete_cache(f"penalty_type:{item_id}")
    return result

@router.delete("/types/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_penalty_type(item_id: str, current_user: dict = Depends(admin_hr_checker)):
    result = await PenaltyService.delete_penalty_type(item_id)
    await delete_cache("penalties:types:all")
    await delete_cache(f"penalty_type:{item_id}")
    return result

# --- Employee Penalties ---
@router.get("/summary", response_model=PenaltySummaryResponse)
async def get_penalty_summary(current_user: dict = Depends(get_current_employee)):
    cache_key = "penalties:summary"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    result = await PenaltyService.get_summary_stats()
    await set_cache(cache_key, result, ttl=300)
    return result

@router.post("", response_model=EmployeePenaltyResponse, status_code=status.HTTP_201_CREATED)
async def create_employee_penalty(data: EmployeePenaltyCreate, current_user: dict = Depends(admin_hr_checker)):
    result = await PenaltyService.create_employee_penalty(data)
    await invalidate_penalty_caches()
    return result

@router.get("", response_model=PaginatedResponse[EmployeePenaltyResponse])
async def get_all_employee_penalties(
    page: Optional[int] = Query(None, ge=1, description="Page number"),
    limit: Optional[int] = Query(None, ge=1, description="Items per page"),
    employee_id: Optional[str] = Query(None, description="Filter by employee ID (Admin/HR only)"),
    penalty_type_id: Optional[str] = Query(None, description="Filter by penalty type ID"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status ('Active', 'Resolved', 'Waived')"),
    type_filter: Optional[str] = Query(None, alias="type", description="Filter by type ('Penalty', 'Warning')"),
    search: Optional[str] = Query(None, description="Search reason or details"),
    start_date: Optional[str] = Query(None, description="Start date in YYYY-MM-DD format"),
    end_date: Optional[str] = Query(None, description="End date in YYYY-MM-DD format"),
    current_user: dict = Depends(get_current_employee)
):
    role = current_user.get("work_details", {}).get("system_role", "Employee")
    current_uid = str(current_user.get("_id") or current_user.get("id"))
    
    def clean_param(val):
        if val is None or str(type(val)).startswith("<class 'fastapi.params"):
            return None
        return val

    page = clean_param(page)
    limit = clean_param(limit)
    status_filter = clean_param(status_filter)
    type_filter = clean_param(type_filter)
    search = clean_param(search)
    start_date = clean_param(start_date)
    end_date = clean_param(end_date)
    penalty_type_id = clean_param(penalty_type_id)

    # If regular Employee, force filter by their own ID
    effective_emp_id = clean_param(employee_id)
    if role not in ["Admin", "Subadmin", "HR"]:
        effective_emp_id = current_uid

    cache_key = make_list_key(
        "penalties",
        page=page,
        limit=limit,
        emp=effective_emp_id,
        pt=penalty_type_id,
        stat=status_filter,
        tp=type_filter,
        q=search,
        start=start_date,
        end=end_date,
        role=role,
        uid=current_uid if role not in ["Admin", "Subadmin", "HR"] else None
    )

    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    result = await PenaltyService.get_all_penalties(
        is_deleted=False, 
        employee_id=effective_emp_id, 
        penalty_type_id=penalty_type_id, 
        status=status_filter,
        type_filter=type_filter,
        search=search,
        start_date=start_date, 
        end_date=end_date, 
        page=page, 
        limit=limit
    )

    await set_cache(cache_key, result, ttl=300)
    return result

@router.get("/deleted", response_model=PaginatedResponse[EmployeePenaltyResponse])
async def get_deleted_employee_penalties(
    page: Optional[int] = Query(None, ge=1, description="Page number"),
    limit: Optional[int] = Query(None, ge=1, description="Items per page"),
    current_user: dict = Depends(admin_hr_checker)
):
    return await PenaltyService.get_all_penalties(is_deleted=True, page=page, limit=limit)

@router.get("/leaderboard")
async def get_penalty_leaderboard(current_user: dict = Depends(get_current_employee)):
    cache_key = "penalties:leaderboard"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    result = await PenaltyService.get_leaderboard()
    await set_cache(cache_key, result, ttl=300)
    return result

@router.put("/{item_id}", response_model=EmployeePenaltyResponse)
async def update_employee_penalty(item_id: str, data: EmployeePenaltyUpdate, current_user: dict = Depends(admin_hr_checker)):
    result = await PenaltyService.update_employee_penalty(item_id, data)
    await invalidate_penalty_caches()
    await delete_cache(f"penalty:{item_id}")
    return result

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def soft_delete_employee_penalty(item_id: str, current_user: dict = Depends(admin_hr_checker)):
    result = await PenaltyService.soft_delete_employee_penalty(item_id)
    await invalidate_penalty_caches()
    await delete_cache(f"penalty:{item_id}")
    return result

