import shutil
import uuid
from pathlib import Path
from typing import List, Dict, Optional
from fastapi import APIRouter, Depends, status, Query, UploadFile, File, HTTPException
from app.schemas.enums import SystemRole, GenderEnum, RelationEnum, WorkModeEnum
from app.schemas.employee import EmployeeCreate, EmployeeOut, EmployeeUpdate
from app.schemas.pagination import PaginatedResponse
from app.services.employee import EmployeeService
from app.controllers.auth import RoleChecker, get_current_user, get_current_employee, DynamicPermissionChecker
from app.redis.service import (
    get_cache,
    set_cache,
    delete_cache,
    clear_pattern,
    make_list_key
)
from app.config import ROOT_DIR

# Root images folder (outside frontend and backend)
IMAGES_DIR = ROOT_DIR / "images"
IMAGES_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"}

router = APIRouter(prefix="/employees", tags=["Employees"])

@router.post("/upload-photo")
@router.post("/upload-image")
async def upload_employee_image(file: UploadFile = File(...)):
    """Uploads employee image, stores it in ROOT/images/employee, and returns accessible URL."""
    emp_dir = IMAGES_DIR / "employee"
    emp_dir.mkdir(parents=True, exist_ok=True)

    file_ext = Path(file.filename or "").suffix.lower()
    if not file_ext or file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid image format. Allowed formats: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    unique_filename = f"emp_{uuid.uuid4().hex[:12]}{file_ext}"
    dest_path = emp_dir / unique_filename

    try:
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save image: {str(e)}"
        )
    finally:
        file.file.close()

    image_url = f"/images/employee/{unique_filename}"
    return {
        "status": "success",
        "url": image_url,
        "profile_photo": image_url,
        "filename": unique_filename
    }

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
@router.post("", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED)
async def create_employee(employee: EmployeeCreate, current_user: dict = Depends(DynamicPermissionChecker())):
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
@router.get("", response_model=PaginatedResponse[EmployeeOut])
async def get_all_employees(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    gender: Optional[GenderEnum] = Query(None, description="Filter by Gender"),
    role_filter: Optional[SystemRole] = Query(None, alias="role", description="Filter by Role"),
    department: Optional[str] = Query(None, description="Filter by Department ID or Name"),
    is_delete: Optional[bool] = Query(None, description="Filter by is_delete"),
    is_block: Optional[bool] = Query(None, description="Filter by is_block"),
    work_mode: Optional[WorkModeEnum] = Query(None, alias="workMode", description="Filter by Work Mode"),
    current_user: dict = Depends(DynamicPermissionChecker())
):
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
async def get_employee(employee_id: str, current_user: dict = Depends(DynamicPermissionChecker())):
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
async def update_employee(employee_id: str, employee: EmployeeUpdate, current_user: dict = Depends(DynamicPermissionChecker())):
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
async def delete_employee(employee_id: str, current_user: dict = Depends(DynamicPermissionChecker())):
    result = await EmployeeService.delete_employee(employee_id)

    # Invalidate single employee cache and all list caches
    await delete_cache(f"employee:{employee_id}")
    await clear_pattern("employees:list:*")

    return result
