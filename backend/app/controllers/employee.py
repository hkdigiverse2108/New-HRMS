import shutil
import uuid
from pathlib import Path
from typing import List, Dict, Optional
from fastapi import APIRouter, Depends, Request, status, Query, UploadFile, File, HTTPException
from app.schemas.enums import SystemRole, GenderEnum, RelationEnum, WorkModeEnum
from app.schemas.employee import EmployeeCreate, EmployeeOut, EmployeeSelfOut, EmployeeUpdate
from app.schemas.pagination import PaginatedResponse
from app.services.employee import EmployeeService
from app.controllers.auth import RoleChecker, get_current_user, get_current_employee, DynamicPermissionChecker, resolve_effective_permissions_for_employee
from app.utils.password_vault import decrypt_password
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


async def _can_view_passwords(requester: dict) -> bool:
    """Who may see decrypted passwords: Admin, or anyone with employees-update permission."""
    try:
        role = (requester.get("work_details") or {}).get("system_role", "Employee")
        if role == "Admin":
            return True
        perms = await resolve_effective_permissions_for_employee(requester)
        for mod in ("/employees", "/employees/list"):
            p = perms.get(mod, {}) or {}
            if p.get("all") or p.get("update"):
                return True
    except Exception:
        pass
    return False


def _strip_password_hash(pi: dict) -> dict:
    return {k: v for k, v in (pi or {}).items() if k != "password"}


def _inject_password(emp: dict) -> dict:
    """Decrypt vault copy into `password` (bcrypt hash never leaves the server)."""
    base_pi = _strip_password_hash(emp.get("personal_info"))
    try:
        enc = base_pi.get("password_enc")
        if enc:
            base_pi["password"] = decrypt_password(enc)
    except Exception:
        pass
    return {**emp, "personal_info": base_pi}

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
@router.get("", response_model=PaginatedResponse[EmployeeSelfOut])
async def get_all_employees(
    page: Optional[int] = Query(None, ge=1),
    limit: Optional[int] = Query(None, ge=1),
    gender: Optional[GenderEnum] = Query(None, description="Filter by Gender"),
    role_filter: Optional[str] = Query(None, alias="role", description="Filter by Role"),
    exclude_role: Optional[str] = Query(None, alias="exclude_role", description="Exclude Role(s), comma-separated (e.g. Admin)"),
    department: Optional[str] = Query(None, description="Filter by Department ID or Name"),
    is_delete: Optional[bool] = Query(None, description="Filter by is_delete"),
    is_block: Optional[bool] = Query(None, description="Filter by is_block"),
    work_mode: Optional[WorkModeEnum] = Query(None, alias="workMode", description="Filter by Work Mode"),
    current_user: dict = Depends(DynamicPermissionChecker())
):
    # Generate unique deterministic key based on all filters and pagination
    cache_key = make_list_key(
        "employees",
        page=page,
        limit=limit,
        gender=gender,
        role=role_filter,
        exclude_role=exclude_role,
        department=department,
        is_delete=is_delete,
        is_block=is_block,
        work_mode=work_mode
    )

    # 1. Check Redis Cache
    cached_data = await get_cache(cache_key)

    # 2. Fetch from DB / Service on cache miss
    # Default: hide soft-deleted (recycle-bin passes is_delete=true explicitly).
    if cached_data is not None:
        response_data = cached_data
    else:
        response_data = await EmployeeService.get_employees(
            page=page,
            limit=limit,
            gender=gender,
            role=role_filter,
            exclude_role=exclude_role,
            department=department,
            is_delete=is_delete if is_delete is not None else False,
            is_block=is_block,
            work_mode=work_mode
        )

        # 3. Store in Redis without time expiry (persists until Add, Edit, or Delete is called)
        # Cache the RAW data (hashes stripped at serve time per viewer).
        await set_cache(cache_key, response_data)

    # 4. Password visibility per viewer (self always; others need update permission).
    try:
        requester_id = str(current_user.get("_id") or current_user.get("id") or "")
        can_view_all = await _can_view_passwords(current_user)
        items = (response_data or {}).get("data") or []
        shaped = []
        for emp in items:
            if can_view_all or (requester_id and requester_id == str(emp.get("_id") or emp.get("id") or "")):
                shaped.append(_inject_password(emp))
            else:
                shaped.append({**emp, "personal_info": _strip_password_hash(emp.get("personal_info"))})
        response_data = {**(response_data or {}), "data": shaped}
    except Exception:
        pass

    return response_data

# ==============================================================================
# 3. GET EMPLOYEE BY ID
# ==============================================================================
@router.get("/{employee_id}", response_model=EmployeeSelfOut)
async def get_employee(employee_id: str, current_user: dict = Depends(DynamicPermissionChecker())):
    cache_key = f"employee:{employee_id}"

    # 1. Check Redis Cache
    cached_emp = await get_cache(cache_key)
    if cached_emp is not None:
        employee = cached_emp
    else:
        # 2. Cache miss: Fetch from DB / Service (never contains visible password)
        employee = await EmployeeService.get_employee(employee_id)

        # 3. Store in Redis (persists until Edit or Delete is called)
        await set_cache(cache_key, employee)

    # 4. Password visibility: self, or Admin / employees-update permission.
    # The raw dict carries the bcrypt hash — strip it first so it can never leak.
    try:
        requester_id = str(current_user.get("_id") or current_user.get("id") or "")
        is_self = bool(requester_id) and requester_id == str(employee.get("_id") or employee.get("id") or "")
        if is_self or await _can_view_passwords(current_user):
            employee = _inject_password(employee)
        else:
            employee = {**employee, "personal_info": _strip_password_hash(employee.get("personal_info"))}
    except Exception:
        pass

    return employee

# ==============================================================================
# 4. EDIT EMPLOYEE
# ==============================================================================
@router.put("/{employee_id}", response_model=EmployeeOut)
async def update_employee(employee_id: str, employee: EmployeeUpdate, request: Request, current_user: dict = Depends(get_current_employee)):
    requester_id = str(current_user.get("_id") or current_user.get("id") or "")
    role = (current_user.get("work_details") or {}).get("system_role", "Employee")
    is_self = bool(requester_id) and requester_id == str(employee_id)

    if is_self and role != "Admin":
        # Self-update: whitelist own profile fields only (no role/salary/dept changes).
        from app.schemas.employee import PersonalInfoUpdate
        allowed_pi = {"first_name", "middle_name", "last_name", "phone_number", "date_of_birth",
                      "gender", "password", "parent_guardian_name", "contact_number",
                      "relation", "profile_photo"}
        raw_pi = employee.personal_info.model_dump(exclude_unset=True) if employee.personal_info else {}
        clean_pi = {k: v for k, v in raw_pi.items() if k in allowed_pi}
        kwargs: dict = {}
        if clean_pi:
            kwargs["personal_info"] = PersonalInfoUpdate(**clean_pi)
        if employee.profile_photo is not None:
            kwargs["profile_photo"] = employee.profile_photo
        employee = EmployeeUpdate(**kwargs)
    elif role != "Admin":
        await DynamicPermissionChecker()(request, current_user)

    updated_emp = await EmployeeService.update_employee(employee_id, employee)

    # 1. Remove old single employee cache & clear all list caches
    await delete_cache(f"employee:{employee_id}")
    await delete_cache(f"user_perms_resolved:{employee_id}")
    await delete_cache(f"user_permission:{employee_id}")
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
