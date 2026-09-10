from fastapi import APIRouter, Depends, status, Query
from typing import List, Dict, Optional
from app.schemas.enums import SystemRole, GenderEnum, RelationEnum, WorkModeEnum
from app.schemas.employee import EmployeeCreate, EmployeeOut, EmployeeUpdate
from app.schemas.pagination import PaginatedResponse
from app.services.employee import EmployeeService
from app.controllers.auth import RoleChecker, get_current_user, get_current_employee
from app.redis.service import (
    get_cache,
    set_cache,
    delete_cache,
    clear_pattern,
    make_list_key
)

router = APIRouter(prefix="/employees", tags=["Employees"])

@router.get("/form-options")
async def get_employee_form_options(current_user: str = Depends(get_current_user)) -> Dict[str, List[dict]]:
    """Returns all static dropdown options for the employee form"""
    return {
        "genders": [{"id": e.value, "label": e.value, "value": e.value} for e in GenderEnum],
        "system_roles": [{"id": e.value, "label": e.value, "value": e.value} for e in SystemRole],
        "relations": [{"id": e.value, "label": e.value, "value": e.value} for e in RelationEnum],
        "work_modes": [{"id": e.value, "label": e.value, "value": e.value} for e in WorkModeEnum]
    }

# ==============================================================================
# 1. ADD EMPLOYEE
# ==============================================================================
@router.post("/", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED)
async def create_employee(employee: EmployeeCreate, current_user: dict = Depends(RoleChecker(["Admin"]))):
    result = await EmployeeService.create_employee(employee)

    # 1. Invalidate get-all list caches so the new employee appears in lists
    await clear_pattern("employees:list:*")

    # 2. Store new employee in Redis cache by ID
    emp_id = str(result.get("_id") or result.get("id"))
    await set_cache(f"employee:{emp_id}", result)

    return result

# ==============================================================================
# 2. GET ALL EMPLOYEES (With Pagination & Filters)
# ==============================================================================
@router.get("/", response_model=PaginatedResponse[EmployeeOut])
async def get_all_employees(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    gender: Optional[GenderEnum] = Query(None, description="Filter by Gender"),
    role_filter: Optional[SystemRole] = Query(None, alias="role", description="Filter by Role"),
    department: Optional[str] = Query(None, description="Filter by Department ID or Name"),
    is_delete: Optional[bool] = Query(None, description="Filter by is_delete"),
    is_block: Optional[bool] = Query(None, description="Filter by is_block"),
    work_mode: Optional[WorkModeEnum] = Query(None, alias="workMode", description="Filter by Work Mode"),
    current_user: dict = Depends(get_current_employee)
):
    role = current_user.get("work_details", {}).get("system_role")
    
    # If the user is just an Employee, only return their own data (no caching needed)
    if role == SystemRole.EMPLOYEE.value:
        return {
            "data": [current_user],
            "total": 1,
            "page": 1,
            "limit": limit,
            "total_pages": 1
        }

    # Generate unique deterministic key based on all filters and pagination
    cache_key = make_list_key("employees", page=page, limit=limit, gender=gender, role=role_filter, department=department, is_delete=is_delete, is_block=is_block, work_mode=work_mode)

    # 1. Check Redis Cache
    cached_data = await get_cache(cache_key)
    if cached_data is not None:
        return cached_data

    # 2. Cache miss: Fetch from DB / Service
    response_data = await EmployeeService.get_employees(page, limit, gender, role_filter, department, is_delete, is_block, work_mode)

    # 3. Store in Redis without time expiry (persists until Add, Edit, or Delete is called)
    await set_cache(cache_key, response_data)

    return response_data

# ==============================================================================
# 3. GET EMPLOYEE BY ID
# ==============================================================================
@router.get("/{employee_id}", response_model=EmployeeOut)
async def get_employee(employee_id: str, current_user: str = Depends(get_current_user)):
    cache_key = f"employee:{employee_id}"

    # 1. Check Redis Cache
    cached_emp = await get_cache(cache_key)
    if cached_emp is not None:
        return cached_emp

    # 2. Cache miss: Fetch from DB / Service
    employee = await EmployeeService.get_employee(employee_id)

    # 3. Store in Redis (persists until Edit or Delete is called)
    await set_cache(cache_key, employee)

    return employee

# ==============================================================================
# 4. EDIT EMPLOYEE
# ==============================================================================
@router.put("/{employee_id}", response_model=EmployeeOut)
async def update_employee(employee_id: str, employee: EmployeeUpdate, current_user: dict = Depends(RoleChecker(["Admin"]))):
    updated_emp = await EmployeeService.update_employee(employee_id, employee)

    # 1. Remove old single employee cache & clear all list caches
    await delete_cache(f"employee:{employee_id}")
    await clear_pattern("employees:list:*")

    # 2. Update employee cache with fresh data
    await set_cache(f"employee:{employee_id}", updated_emp)

    return updated_emp

# ==============================================================================
# 5. DELETE EMPLOYEE
# ==============================================================================
@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_employee(employee_id: str, current_user: dict = Depends(RoleChecker(["Admin"]))):
    result = await EmployeeService.delete_employee(employee_id)

    # Invalidate single employee cache and all list caches
    await delete_cache(f"employee:{employee_id}")
    await clear_pattern("employees:list:*")

    return result
