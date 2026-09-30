"""Reversible password vault (employee self-view only).

Login always uses the bcrypt hash in personal_info.password.
The Fernet-encrypted copy in personal_info.password_enc exists ONLY so an
employee can see their own current password (prefill on self-edit).
It is NEVER returned for anyone else (not even Admin).
Key is derived from SECRET_KEY — no new config needed.
"""
import base64
import hashlib

from cryptography.fernet import Fernet

from app.config import settings


def _fernet() -> Fernet:
    raw = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(raw))


def encrypt_password(plain: str) -> str:
    return _fernet().encrypt(str(plain).encode("utf-8")).decode("utf-8")


def decrypt_password(token: str) -> str:
    return _fernet().decrypt(str(token).encode("utf-8")).decode("utf-8")
