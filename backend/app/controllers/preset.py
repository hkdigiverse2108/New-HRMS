from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, List
from app.schemas.preset import PresetCreate, PresetUpdate, PresetResponse, ApplyPresetPayload
from app.services.preset import PresetService
from app.controllers.auth import get_current_employee
from app.redis.service import get_cache, set_cache, clear_pattern, make_list_key

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
    await clear_pattern("presets:*")
    return await PresetService.get_preset_by_id(created["_id"])

@router.get("", response_model=List[PresetResponse])
async def get_all_presets(
    preset_type: Optional[str] = Query(None, description="Filter by preset_type: 'normal' or 'intern'"),
    current_user: dict = Depends(get_current_employee)
):
    cache_key = make_list_key("presets:list", pt=preset_type)
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    res = await PresetService.get_all_presets(preset_type)
    if res is not None:
        await set_cache(cache_key, res, ttl=120)
    return res

@router.get("/{preset_id}", response_model=PresetResponse)
async def get_preset(preset_id: str, current_user: dict = Depends(get_current_employee)):
    cache_key = f"presets:item:{preset_id}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    item = await PresetService.get_preset_by_id(preset_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preset not found")

    await set_cache(cache_key, item, ttl=120)
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

    await clear_pattern("presets:*")
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
    await clear_pattern("presets:*")

@router.post("/{preset_id}/apply", status_code=status.HTTP_200_OK)
async def apply_preset(preset_id: str, payload: ApplyPresetPayload, current_user: dict = Depends(get_current_employee)):
    # Applies a normal preset to a specific project
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    success = await PresetService.apply_preset_to_project(preset_id, payload.project_id, emp_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to apply preset. Make sure it's a 'normal' preset.")

    await clear_pattern("presets:*")
    await clear_pattern("projects:*")
    await clear_pattern("tasks:*")
    return {"message": "Preset applied successfully"}
