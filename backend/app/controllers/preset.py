from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, List
from app.schemas.preset import PresetCreate, PresetUpdate, PresetResponse, ApplyPresetPayload
from app.services.preset import PresetService
from app.controllers.auth import get_current_employee

router = APIRouter(prefix="/development-presets", tags=["Development Presets"])

def check_preset_permissions(current_user: dict):
    role = current_user.get("work_details", {}).get("system_role", "Employee")
    designation = str(current_user.get("work_details", {}).get("designation", "")).lower()
    
    if role not in ["Admin", "Subadmin", "HR"] and designation not in ["team leader", "head"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Only Admins, Subadmins, HRs, Team Leaders, and Heads can manage presets."
        )

@router.post("", response_model=PresetResponse, status_code=status.HTTP_201_CREATED)
async def create_preset(data: PresetCreate, current_user: dict = Depends(get_current_employee)):
    check_preset_permissions(current_user)
    
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    created = await PresetService.create_preset(data, emp_id)
    return await PresetService.get_preset_by_id(created["_id"])

@router.get("", response_model=List[PresetResponse])
async def get_all_presets(
    preset_type: Optional[str] = Query(None, description="Filter by preset_type: 'normal' or 'intern'"),
    current_user: dict = Depends(get_current_employee)
):
    return await PresetService.get_all_presets(preset_type)

@router.get("/{preset_id}", response_model=PresetResponse)
async def get_preset(preset_id: str, current_user: dict = Depends(get_current_employee)):
    item = await PresetService.get_preset_by_id(preset_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preset not found")
    return item

@router.put("/{preset_id}", response_model=PresetResponse)
async def update_preset(preset_id: str, data: PresetUpdate, current_user: dict = Depends(get_current_employee)):
    check_preset_permissions(current_user)
    
    item = await PresetService.get_preset_by_id(preset_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preset not found")
        
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    updated = await PresetService.update_preset(preset_id, data, emp_id)
    if not updated:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update preset")
        
    return await PresetService.get_preset_by_id(preset_id)

@router.delete("/{preset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_preset(preset_id: str, current_user: dict = Depends(get_current_employee)):
    check_preset_permissions(current_user)
    
    item = await PresetService.get_preset_by_id(preset_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preset not found")
        
    success = await PresetService.delete_preset(preset_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete preset")

@router.post("/{preset_id}/apply", status_code=status.HTTP_200_OK)
async def apply_preset(preset_id: str, payload: ApplyPresetPayload, current_user: dict = Depends(get_current_employee)):
    # Applies a normal preset to a specific project
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    success = await PresetService.apply_preset_to_project(preset_id, payload.project_id, emp_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to apply preset. Make sure it's a 'normal' preset.")
    return {"message": "Preset applied successfully"}
