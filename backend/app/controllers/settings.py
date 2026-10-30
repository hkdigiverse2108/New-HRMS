from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from typing import Optional
from app.schemas.settings import SettingsCreateOrUpdate, SettingsResponse, BrandingSettings
from app.services.settings import SettingsService
from app.controllers.auth import get_current_employee
from app.redis.service import get_cache, set_cache, clear_pattern
import os
import shutil

router = APIRouter(prefix="/settings", tags=["Settings"])

def check_admin_role(user: dict):
    work = user.get("work_details", {})
    role = str(work.get("system_role") or user.get("system_role", "Employee")).strip()
    if role.lower() not in ["admin", "subadmin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Admin can modify company settings")
    return role

@router.get("", response_model=SettingsResponse)
async def get_settings(current_user: dict = Depends(get_current_employee)):
    cache_key = "settings:company"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    res = await SettingsService.get_settings()
    if res is not None:
        await set_cache(cache_key, res, ttl=300)
    return res

@router.get("/branding", response_model=Optional[BrandingSettings])
async def get_branding():
    """Public: the login page is themed too. Null until an admin saves branding once."""
    return await SettingsService.get_branding()

@router.put("/branding", response_model=BrandingSettings)
async def update_branding(data: BrandingSettings, current_user: dict = Depends(get_current_employee)):
    check_admin_role(current_user)
    res = await SettingsService.update_branding(data)
    await clear_pattern("settings:*")
    return res

@router.put("", response_model=SettingsResponse)
async def update_settings(
    data: SettingsCreateOrUpdate,
    current_user: dict = Depends(get_current_employee)
):
    check_admin_role(current_user)
    res = await SettingsService.update_settings(data)
    await clear_pattern("settings:*")
    return res

@router.post("/logo", response_model=SettingsResponse)
async def upload_company_logo(
    file: Optional[UploadFile] = File(None),
    logo: Optional[UploadFile] = File(None),
    image: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_employee)
):
    check_admin_role(current_user)
    upload_file = file or logo or image
    if not upload_file or not upload_file.filename:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Please upload a valid logo file using key 'file' or 'logo'")

    os.makedirs("uploads/settings", exist_ok=True)
    filename = f"logo_{upload_file.filename}"
    file_path = os.path.join("uploads", "settings", filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)

    web_url = f"/uploads/settings/{filename}"
    current_settings = await SettingsService.get_settings()
    current_settings["logo_url"] = web_url

    update_dto = SettingsCreateOrUpdate(**current_settings)
    res = await SettingsService.update_settings(update_dto)
    await clear_pattern("settings:*")
    return res

@router.post("/signature", response_model=SettingsResponse)
async def upload_authorized_signature(
    file: Optional[UploadFile] = File(None),
    signature: Optional[UploadFile] = File(None),
    image: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_employee)
):
    check_admin_role(current_user)
    upload_file = file or signature or image
    if not upload_file or not upload_file.filename:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Please upload a valid signature file using key 'file' or 'signature'")

    os.makedirs("uploads/settings", exist_ok=True)
    filename = f"signature_{upload_file.filename}"
    file_path = os.path.join("uploads", "settings", filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)

    web_url = f"/uploads/settings/{filename}"
    current_settings = await SettingsService.get_settings()
    current_settings["signature_url"] = web_url

    update_dto = SettingsCreateOrUpdate(**current_settings)
    res = await SettingsService.update_settings(update_dto)
    await clear_pattern("settings:*")
    return res

@router.post("/letterhead", response_model=SettingsResponse)
async def upload_company_letterhead(
    file: Optional[UploadFile] = File(None),
    letterhead: Optional[UploadFile] = File(None),
    image: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_employee)
):
    check_admin_role(current_user)
    upload_file = file or letterhead or image
    if not upload_file or not upload_file.filename:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Please upload a valid letterhead file using key 'file' or 'letterhead'")

    os.makedirs("uploads/settings", exist_ok=True)
    filename = f"letterhead_{upload_file.filename}"
    file_path = os.path.join("uploads", "settings", filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)

    web_url = f"/uploads/settings/{filename}"
    current_settings = await SettingsService.get_settings()
    current_settings["letterhead_url"] = web_url

    update_dto = SettingsCreateOrUpdate(**current_settings)
    res = await SettingsService.update_settings(update_dto)
    await clear_pattern("settings:*")
    return res

from pydantic import BaseModel, Field

class GlobalTimelineSettings(BaseModel):
    script_days_before: int = Field(16, ge=0, description="Script days before posting")
    shoot_days_before: int = Field(14, ge=0, description="Shoot days before posting")
    editing_graphics_days_before: int = Field(7, ge=0, description="Editing/Graphics days before posting")
    thumbnail_days_before: int = Field(5, ge=0, description="Thumbnail days before posting")
    approval_days_before: int = Field(5, ge=0, description="Approval days before posting")

@router.get("/content-timeline", response_model=GlobalTimelineSettings)
async def get_global_content_timeline():
    from app.services.content import ContentService
    settings = await ContentService.get_settings("global")
    return GlobalTimelineSettings(
        script_days_before=settings.get("script_days_before", 16),
        shoot_days_before=settings.get("shoot_days_before", 14),
        editing_graphics_days_before=settings.get("editing_graphics_days_before", 7),
        thumbnail_days_before=settings.get("thumbnail_days_before", 5),
        approval_days_before=settings.get("approval_days_before", 5),
    )

@router.put("/content-timeline", response_model=GlobalTimelineSettings)
async def update_global_content_timeline(
    data: GlobalTimelineSettings,
    current_user: dict = Depends(get_current_employee)
):
    check_admin_role(current_user)
    from app.services.content import ContentService
    from app.schemas.content import ContentTimelineSettings
    settings_dto = ContentTimelineSettings(
        project_id="global",
        script_days_before=data.script_days_before,
        shoot_days_before=data.shoot_days_before,
        editing_graphics_days_before=data.editing_graphics_days_before,
        thumbnail_days_before=data.thumbnail_days_before,
        approval_days_before=data.approval_days_before,
    )
    res = await ContentService.update_settings("global", settings_dto)
    await clear_pattern("settings:*")
    await clear_pattern("content:global:*")
    return GlobalTimelineSettings(
        script_days_before=res.get("script_days_before", 16),
        shoot_days_before=res.get("shoot_days_before", 14),
        editing_graphics_days_before=res.get("editing_graphics_days_before", 7),
        thumbnail_days_before=res.get("thumbnail_days_before", 5),
        approval_days_before=res.get("approval_days_before", 5),
    )
