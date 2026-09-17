from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any, Optional
import asyncio
import json
from datetime import datetime
from jose import jwt, JWTError
from app.config import settings
from app.schemas.access_control import (
    UserAccessControlCreate, UserAccessControlUpdate, UserAccessControlResponse,
    PermissionPresetCreate, PermissionPresetUpdate, PermissionPresetResponse
)
from app.repository.access_control import UserPermissionRepository, PresetPermissionRepository, has_manual_permissions
from app.repository.employee import EmployeeRepository
from app.controllers.auth import RoleChecker
from app.redis.service import get_cache, set_cache, delete_cache, clear_pattern
from app.database.default_presets import (
    SYSTEM_MODULES, 
    DEFAULT_EMPLOYEE_PERMISSIONS, 
    DEFAULT_HR_PERMISSIONS, 
    get_admin_full_permissions,
    get_default_permissions_for_department
)
from app.database.db import get_database

router = APIRouter(
    prefix="/permissions",
    tags=["Access Control"]
)

# Protect all modification endpoints so only Admins can manage access control
admin_role_checker = RoleChecker(["Admin", "CEO"])

# ==========================================
# Real-Time SSE Listeners & Broadcast Helper
# ==========================================
active_permission_listeners: Dict[str, asyncio.Queue] = {}

async def broadcast_permission_update(employee_id: Optional[str] = None, role: Optional[str] = None, department: Optional[str] = None):
    """Notify all connected SSE clients about permission changes immediately."""
    event_payload = json.dumps({
        "type": "PERMISSIONS_UPDATED",
        "employee_id": employee_id,
        "role": role,
        "department": department,
        "timestamp": datetime.utcnow().isoformat()
    })
    dead_clients = []
    for cid, queue in list(active_permission_listeners.items()):
        try:
            await queue.put(event_payload)
        except Exception:
            dead_clients.append(cid)
    for cid in dead_clients:
        active_permission_listeners.pop(cid, None)

# ==========================================
# System Modules Definition
# ==========================================
@router.get("/modules", response_model=List[Dict[str, Any]])
async def get_system_modules():
    """Returns the list of all configurable system modules with sections."""
    return SYSTEM_MODULES

@router.get("/defaults", response_model=Dict[str, Any])
async def get_default_permissions():
    """Returns standard default permissions for general employee, HR, and admin."""
    return {
        "admin_permissions": get_admin_full_permissions(),
        "hr_permissions": DEFAULT_HR_PERMISSIONS,
        "default_employee_permissions": DEFAULT_EMPLOYEE_PERMISSIONS
    }

@router.get("/roles", response_model=List[str])
async def get_available_roles():
    """Returns list of distinct roles available in HRMS (Admin and Employee only)."""
    return ["Admin", "Employee"]

@router.get("/departments", response_model=List[str])
async def get_available_departments():
    """Returns list of all available departments for Department Presets."""
    db = get_database()
    depts = await db["departments"].find({}).to_list(100)
    if depts:
        return [d["name"] for d in depts if d.get("name")]
    return ["HR", "Development", "Management", "Python", "Sales", "Creative", "Product", "Digital Marketing", "Finance"]

# ==========================================
# Permission Presets API Endpoints (Department & Role Wise)
# ==========================================
@router.get("/presets", response_model=List[PermissionPresetResponse])
async def get_all_presets():
    """Fetches all presets from database with Redis caching."""
    cache_key = "presets:list:all"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    presets = await PresetPermissionRepository.get_all_presets()
    await set_cache(cache_key, presets)
    return presets

@router.post("/presets", response_model=PermissionPresetResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(admin_role_checker)])
async def create_or_update_preset(item: PermissionPresetCreate):
    item_data = item.dict(exclude_unset=True)
    created_item = await PresetPermissionRepository.create_preset(item_data)
    
    # Invalidate Redis caches so all employees immediately reflect the updated preset
    await clear_pattern("preset:*")
    await clear_pattern("presets:list:*")
    await clear_pattern("user_perms_resolved:*")
    await clear_pattern("user_permission:*")
    
    # Clean up non-custom records in user_permissions so employees seamlessly inherit the preset
    db = get_database()
    await db["user_permissions"].delete_many({"$or": [{"is_custom": False}, {"is_custom": None}]})
    
    # Broadcast live update to all connected clients
    await broadcast_permission_update(role=item_data.get("role"), department=item_data.get("department"))
    
    return created_item

@router.get("/presets/department/{department_name}", response_model=PermissionPresetResponse)
async def get_preset_by_department(department_name: str):
    """Fetches preset permissions for a specific department (e.g. HR, Development, Sales, etc.)."""
    clean_dept = str(department_name).strip()
    cache_key = f"preset:department:{clean_dept}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    item = await PresetPermissionRepository.get_preset_by_department(clean_dept)
    if not item:
        # Fallback to seeded defaults if not yet in DB
        perms = get_default_permissions_for_department(clean_dept)
        result = {
            "_id": "",
            "role": "Employee",
            "department": clean_dept,
            "department_id": "all",
            "designation_id": "all",
            "module_permissions": perms
        }
        await set_cache(cache_key, result)
        return result

    await set_cache(cache_key, item)
    return item

@router.get("/presets/{role}", response_model=PermissionPresetResponse)
async def get_preset_by_role(role: str):
    """Fetches preset permissions for a specific role (e.g. Admin, Employee)."""
    clean_role = str(role).strip()
    cache_key = f"preset:role:{clean_role}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    item = await PresetPermissionRepository.get_preset_by_role(clean_role)
    if not item:
        if clean_role == "Admin":
            perms = get_admin_full_permissions()
        elif clean_role == "HR":
            perms = DEFAULT_HR_PERMISSIONS
        else:
            perms = DEFAULT_EMPLOYEE_PERMISSIONS

        result = {
            "_id": "",
            "role": clean_role,
            "department_id": "all",
            "designation_id": "all",
            "module_permissions": perms
        }
        await set_cache(cache_key, result)
        return result

    await set_cache(cache_key, item)
    return item

@router.put("/presets/{preset_id}", response_model=dict, dependencies=[Depends(admin_role_checker)])
async def update_preset(preset_id: str, item: PermissionPresetUpdate):
    update_data = item.dict(exclude_unset=True)
    if "module_permissions" not in update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields provided for update")
        
    preset = await PresetPermissionRepository.get_preset_by_id(preset_id)
    if not preset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preset not found")
        
    success = await PresetPermissionRepository.update_preset(preset_id, update_data["module_permissions"])
    if not success:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update preset")
        
    # Invalidate Redis caches
    await clear_pattern("preset:*")
    await clear_pattern("presets:list:*")
    await clear_pattern("user_perms_resolved:*")
    await clear_pattern("user_permission:*")

    # Clean up non-custom records in user_permissions so employees seamlessly inherit the updated preset
    db = get_database()
    await db["user_permissions"].delete_many({"$or": [{"is_custom": False}, {"is_custom": None}]})
        
    await broadcast_permission_update()
    return {"message": "Preset updated successfully"}

@router.delete("/presets/{preset_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(admin_role_checker)])
async def delete_preset(preset_id: str):
    success = await PresetPermissionRepository.delete_preset(preset_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preset not found")
        
    await clear_pattern("preset:*")
    await clear_pattern("presets:list:*")
    await clear_pattern("user_perms_resolved:*")
    await clear_pattern("user_permission:*")
    await broadcast_permission_update()
    return None

# ==========================================
# User Permissions API Endpoints
# ==========================================
@router.post("", response_model=UserAccessControlResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(admin_role_checker)])
async def create_or_update_user_permission(item: UserAccessControlCreate):
    item_data = item.dict(exclude_unset=True)
    created_item = await UserPermissionRepository.create_user_permission(item_data, is_custom=True)
    
    emp_id = str(item_data["employee_id"]).strip()
    await delete_cache(f"user_permission:{emp_id}")
    await delete_cache(f"user_perms_resolved:{emp_id}")
    await set_cache(f"user_permission:{emp_id}", created_item)
    
    # Broadcast live update to employee
    await broadcast_permission_update(employee_id=emp_id)
    return created_item

# ==========================================
# Real-Time SSE Stream Endpoint
# (Declared BEFORE /{employee_id} so FastAPI matches /stream correctly)
# ==========================================
@router.get("/stream")
async def stream_permission_events(request: Request, token: Optional[str] = None):
    """
    Real-time Server-Sent Events (SSE) endpoint.
    Streams live permission updates and revocations to connected user browsers.
    """
    auth_token = token
    if not auth_token:
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            auth_token = auth_header.split(" ")[1]

    if not auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is required for streaming permissions"
        )

    try:
        payload = jwt.decode(auth_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        client_email = payload.get("sub")
        if not client_email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload: missing subject"
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token"
        )

    # Check employee details if not default admin
    employee = await EmployeeRepository.get_employee_by_email(client_email)
    emp_id = None
    role = None
    if employee:
        work_details = employee.get("work_details", {})
        if work_details.get("is_delete") is True or work_details.get("is_block") is True:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account is deactivated")
        emp_id = str(employee.get("_id", ""))
        role = work_details.get("system_role", "Employee")
    elif client_email == "admin@hrms.com":
        emp_id = "default-admin-id"
        role = "Admin"
    else:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Employee not found")

    async def event_generator():
        queue: asyncio.Queue = asyncio.Queue()
        client_id = f"{client_email}_{id(queue)}"
        active_permission_listeners[client_id] = queue
        try:
            # Initial connection confirmation payload
            init_payload = json.dumps({
                "type": "CONNECTED",
                "email": client_email,
                "employee_id": emp_id,
                "role": role,
                "timestamp": datetime.utcnow().isoformat()
            })
            yield f"data: {init_payload}\n\n"

            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=20.0)
                    yield f"data: {data}\n\n"
                except asyncio.TimeoutError:
                    # Keep-alive heartbeat ping comment
                    yield ": ping\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            active_permission_listeners.pop(client_id, None)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )

@router.get("/{employee_id}", response_model=UserAccessControlResponse)
async def get_user_permission(employee_id: str):
    cache_key = f"user_permission:{employee_id}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    # Fetch employee to know their work details and role
    employee = await EmployeeRepository.get_employee_by_id(employee_id)
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    work_details = employee.get("work_details", {})
    system_role = work_details.get("system_role", "Employee")
    department = work_details.get("department", "Development")
    
    # 1. If Admin, always return Admin full permissions
    if system_role == "Admin":
        admin_perms = get_admin_full_permissions()
        res = {
            "_id": "",
            "employee_id": employee_id,
            "module_permissions": admin_perms,
            "is_custom": False,
            "inherited_from": "Master Admin (Full Unrestricted Access)"
        }
        await set_cache(cache_key, res)
        return res

    # 2. Check if employee has custom permissions explicitly configured
    item = await UserPermissionRepository.get_user_permission(employee_id)
    if item and item.get("is_custom") is True and has_manual_permissions(item.get("module_permissions")):
        res = {
            "_id": str(item["_id"]),
            "employee_id": employee_id,
            "module_permissions": item.get("module_permissions", {}),
            "is_custom": True,
            "inherited_from": None
        }
        await set_cache(cache_key, res)
        return res

    # 3. Inherit dynamically from Department Preset
    preset, inherited_desc = await PresetPermissionRepository.get_preset_for_employee(system_role, department)
    
    if preset and "module_permissions" in preset:
        res = {
            "_id": "",
            "employee_id": employee_id,
            "module_permissions": preset["module_permissions"],
            "is_custom": False,
            "inherited_from": inherited_desc
        }
    else:
        res = {
            "_id": "",
            "employee_id": employee_id,
            "module_permissions": get_default_permissions_for_department(department),
            "is_custom": False,
            "inherited_from": f"Default Department Permissions ({department})"
        }

    await set_cache(cache_key, res)
    return res

@router.put("/{employee_id}", response_model=dict, dependencies=[Depends(admin_role_checker)])
async def update_user_permission(employee_id: str, item: UserAccessControlUpdate):
    update_data = item.dict(exclude_unset=True)
    if "module_permissions" not in update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields provided for update")
        
    emp_id = str(employee_id).strip()
    await UserPermissionRepository.create_user_permission({
        "employee_id": emp_id,
        "module_permissions": update_data["module_permissions"]
    }, is_custom=True)
        
    await delete_cache(f"user_permission:{emp_id}")
    await delete_cache(f"user_perms_resolved:{emp_id}")
    
    # Broadcast live update to employee
    await broadcast_permission_update(employee_id=emp_id)
    return {"message": "User permission updated successfully"}

@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(admin_role_checker)])
async def delete_user_permission(employee_id: str):
    emp_id = str(employee_id).strip()
    await UserPermissionRepository.delete_user_permission(emp_id)
    await delete_cache(f"user_permission:{emp_id}")
    await delete_cache(f"user_perms_resolved:{emp_id}")
    
    # Broadcast live update to employee
    await broadcast_permission_update(employee_id=emp_id)
    return None
