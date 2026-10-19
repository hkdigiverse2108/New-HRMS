from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timedelta
import hashlib
import secrets
from app.database.db import get_database
from app.controllers.auth import get_current_employee
from app.controllers.settings import check_admin_role
from app.utils.email import send_otp_email, public_base_url

router = APIRouter(prefix="/finance-lock", tags=["Finance Lock"])

SETTINGS_COLLECTION = "finance_settings"
OTP_COLLECTION = "finance_otps"
LOCK_SETTINGS_ID = "otp_lock"
OTP_TTL = timedelta(minutes=5)
UNLOCK_MINUTES = 30
MAX_ATTEMPTS = 5


class LockSettingsUpdate(BaseModel):
    otp_email: Optional[EmailStr] = None
    # Required once an email is set: the OTP sent to the current email via /change-otp
    otp: Optional[str] = None


class VerifyRequest(BaseModel):
    otp: str


def _hash(otp: str) -> str:
    return hashlib.sha256(otp.encode("utf-8")).hexdigest()


def _mask(email: str) -> str:
    name, _, domain = email.partition("@")
    return f"{name[:2]}{'*' * max(len(name) - 2, 1)}@{domain}"


async def _otp_email() -> Optional[str]:
    doc = await get_database()[SETTINGS_COLLECTION].find_one({"_id": LOCK_SETTINGS_ID})
    return (doc or {}).get("otp_email") or None


def _user_key(user: dict) -> str:
    return str(user.get("_id") or user.get("email"))


def _new_otp() -> str:
    return f"{secrets.randbelow(900000) + 100000}"


async def _store_otp(key: str, otp: str) -> None:
    await get_database()[OTP_COLLECTION].update_one(
        {"_id": key},
        {"$set": {"otp_hash": _hash(otp), "expires_at": datetime.utcnow() + OTP_TTL, "attempts": 0}},
        upsert=True,
    )


async def _check_otp(key: str, otp: str) -> None:
    """Raises on a missing, expired or wrong OTP; a correct OTP is used up."""
    col = get_database()[OTP_COLLECTION]
    doc = await col.find_one({"_id": key})
    if not doc or doc.get("expires_at", datetime.min) < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP expired. Please request a new one.")
    if doc.get("attempts", 0) >= MAX_ATTEMPTS:
        await col.delete_one({"_id": key})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Too many wrong attempts. Please request a new OTP.")
    if not secrets.compare_digest(doc.get("otp_hash", ""), _hash(otp.strip())):
        await col.update_one({"_id": key}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OTP")
    await col.delete_one({"_id": key})


@router.get("/settings")
async def get_lock_settings(current_user: dict = Depends(get_current_employee)):
    check_admin_role(current_user)
    email = await _otp_email()
    return {"configured": bool(email), "email": email}


@router.post("/change-otp")
async def request_change_otp(background_tasks: BackgroundTasks, http_request: Request, current_user: dict = Depends(get_current_employee)):
    """Changing the finance email needs an OTP sent to the current finance email."""
    check_admin_role(current_user)
    email = await _otp_email()
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No finance email is set yet. Save one directly.")
    otp = _new_otp()
    await _store_otp(f"change:{_user_key(current_user)}", otp)
    requester = current_user.get("email") or "an admin"
    background_tasks.add_task(
        send_otp_email, email, otp,
        subject="Change Finance OTP Email - HK DigiVerse HRMS",
        heading="Change Finance OTP Email",
        intro=f"<strong>{requester}</strong> wants to change the email that receives Finance OTPs in <strong>HK DigiVerse HRMS</strong>. Share this 6-digit code with them only if you approve the change:",
        base_url=public_base_url(http_request),
    )
    return {"message": "OTP sent", "email": _mask(email)}


@router.put("/settings")
async def update_lock_settings(data: LockSettingsUpdate, current_user: dict = Depends(get_current_employee)):
    check_admin_role(current_user)
    if await _otp_email():
        if not (data.otp or "").strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Enter the OTP sent to the current finance email")
        await _check_otp(f"change:{_user_key(current_user)}", data.otp)
    email = str(data.otp_email).strip().lower() if data.otp_email else None
    await get_database()[SETTINGS_COLLECTION].update_one(
        {"_id": LOCK_SETTINGS_ID},
        {"$set": {"otp_email": email, "updated_at": datetime.utcnow()}},
        upsert=True,
    )
    return {"configured": bool(email), "email": email}


@router.get("/status")
async def lock_status(current_user: dict = Depends(get_current_employee)):
    """Finance pages are locked only once a finance OTP email is set."""
    email = await _otp_email()
    return {"enabled": bool(email), "email": _mask(email) if email else None, "unlock_minutes": UNLOCK_MINUTES}


@router.post("/request-otp")
async def request_otp(background_tasks: BackgroundTasks, http_request: Request, current_user: dict = Depends(get_current_employee)):
    email = await _otp_email()
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Finance OTP email is not set")
    otp = _new_otp()
    await _store_otp(_user_key(current_user), otp)
    requester = current_user.get("email") or "a user"
    background_tasks.add_task(
        send_otp_email, email, otp,
        subject="Finance Access OTP - HK DigiVerse HRMS",
        heading="Finance Access Code",
        intro=f"<strong>{requester}</strong> is trying to open the Finance section of <strong>HK DigiVerse HRMS</strong>. Share this 6-digit code with them only if you approve the access:",
        base_url=public_base_url(http_request),
    )
    return {"message": "OTP sent", "email": _mask(email)}


@router.post("/verify-otp")
async def verify_otp(data: VerifyRequest, current_user: dict = Depends(get_current_employee)):
    await _check_otp(_user_key(current_user), data.otp)
    return {"message": "Verified", "unlock_minutes": UNLOCK_MINUTES}
