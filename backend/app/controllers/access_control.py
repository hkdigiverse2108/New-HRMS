from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from app.schemas.access_control import (
    UserAccessControlCreate, UserAccessControlUpdate, UserAccessControlResponse,
    PermissionPresetCreate, PermissionPresetUpdate, PermissionPresetResponse
)
from app.repository.access_control import UserPermissionRepository, PresetPermissionRepository, has_manual_permissions
from app.repository.employee import EmployeeRepository
from app.controllers.auth import RoleChecker

router = APIRouter(
    prefix="/permissions",
    tags=["Access Control"]
)

# Optional: Protect all endpoints so only Admins can manage the access control list
admin_role_checker = RoleChecker(["Admin", "CEO"])

# ==========================================
# Permission Presets API Endpoints
# ==========================================
@router.post("/presets", response_model=PermissionPresetResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(admin_role_checker)])
async def create_or_update_preset(item: PermissionPresetCreate):
    item_data = item.dict(exclude_unset=True)
    created_item = await PresetPermissionRepository.create_preset(item_data)
    
    # Update permissions ONLY for employees with no manual permissions (or all false)
    employees = await EmployeeRepository.get_employees_by_dept_and_desig(
        item_data["department_id"], item_data["designation_id"]
    )
    for emp in employees:
        emp_id = str(emp["_id"])
        existing = await UserPermissionRepository.get_user_permission(emp_id)
        existing_perms = existing.get("module_permissions", {}) if existing else {}
        if not has_manual_permissions(existing_perms):
            await UserPermissionRepository.create_user_permission({
                "employee_id": emp_id,
                "module_permissions": item_data["module_permissions"]
            })
        
    return created_item

@router.get("/presets/{department_id}/{designation_id}", response_model=PermissionPresetResponse)
async def get_preset(department_id: str, designation_id: str):
    item = await PresetPermissionRepository.get_preset(department_id, designation_id)
    if not item:
        return {"_id": "", "department_id": department_id, "designation_id": designation_id, "module_permissions": {}}
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
        
    # Update permissions ONLY for employees with no manual permissions (or all false)
    employees = await EmployeeRepository.get_employees_by_dept_and_desig(
        preset["department_id"], preset["designation_id"]
    )
    for emp in employees:
        emp_id = str(emp["_id"])
        existing = await UserPermissionRepository.get_user_permission(emp_id)
        existing_perms = existing.get("module_permissions", {}) if existing else {}
        if not has_manual_permissions(existing_perms):
            await UserPermissionRepository.create_user_permission({
                "employee_id": emp_id,
                "module_permissions": update_data["module_permissions"]
            })
        
    return {"message": "Preset updated successfully"}

@router.delete("/presets/{preset_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(admin_role_checker)])
async def delete_preset(preset_id: str):
    success = await PresetPermissionRepository.delete_preset(preset_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preset not found")
    return None

# ==========================================
# User Permissions API Endpoints
# ==========================================
@router.post("", response_model=UserAccessControlResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(admin_role_checker)])
async def create_or_update_user_permission(item: UserAccessControlCreate):
    item_data = item.dict(exclude_unset=True)
    created_item = await UserPermissionRepository.create_user_permission(item_data)
    return created_item

@router.get("/{employee_id}", response_model=UserAccessControlResponse)
async def get_user_permission(employee_id: str):
    item = await UserPermissionRepository.get_user_permission(employee_id)
    manual_perms = item.get("module_permissions", {}) if item else {}
    
    # Fallback to Presets if manual permissions don't exist or all are false
    if not has_manual_permissions(manual_perms):
        employee = await EmployeeRepository.get_employee_by_id(employee_id)
        if employee:
            dept_id = employee.get("work_details", {}).get("department")
            desig_id = employee.get("work_details", {}).get("designation")
            
            if dept_id and desig_id:
                preset = await PresetPermissionRepository.get_preset(dept_id, desig_id)
                if preset:
                    preset_perms = preset.get("module_permissions", {})
                    if preset_perms:
                        manual_perms = preset_perms

    if item:
        item["module_permissions"] = manual_perms
        return item
    else:
        # Return merged/preset permissions rather than 404 to avoid frontend errors
        return {"_id": "", "employee_id": employee_id, "module_permissions": manual_perms}


@router.put("/{employee_id}", response_model=dict, dependencies=[Depends(admin_role_checker)])
async def update_user_permission(employee_id: str, item: UserAccessControlUpdate):
    update_data = item.dict(exclude_unset=True)
    if "module_permissions" not in update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields provided for update")
        
    success = await UserPermissionRepository.update_user_permission(employee_id, update_data["module_permissions"])
    if not success:
        # If user permission record does not exist yet, we could potentially create it, but for explicit PUT we fail
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User permission not found")
        
    return {"message": "User permission updated successfully"}

@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(admin_role_checker)])
async def delete_user_permission(employee_id: str):
    success = await UserPermissionRepository.delete_user_permission(employee_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User permission not found")
    return None
