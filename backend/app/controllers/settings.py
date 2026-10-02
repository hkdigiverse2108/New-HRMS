from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from typing import Optional
from app.schemas.settings import SettingsCreateOrUpdate, SettingsResponse
from app.services.settings import SettingsService
from app.controllers.auth import get_current_employee
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
    return await SettingsService.get_settings()

@router.put("", response_model=SettingsResponse)
async def update_settings(
    data: SettingsCreateOrUpdate,
    current_user: dict = Depends(get_current_employee)
):
    check_admin_role(current_user)
    return await SettingsService.update_settings(data)

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
    return await SettingsService.update_settings(update_dto)

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
    return await SettingsService.update_settings(update_dto)

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
    return await SettingsService.update_settings(update_dto)
