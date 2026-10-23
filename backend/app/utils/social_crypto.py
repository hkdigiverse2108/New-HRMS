import base64
import hashlib
from cryptography.fernet import Fernet
from app.config import settings

def _fernet() -> Fernet:
    key_material = getattr(settings, "TOKEN_ENCRYPTION_KEY", "") or getattr(settings, "SOCIAL_ENC_KEY", "") or settings.SECRET_KEY
    try:
        raw_key = key_material.strip().encode("utf-8")
        if len(base64.urlsafe_b64decode(raw_key)) == 32:
            return Fernet(raw_key)
    except Exception:
        pass
    raw = hashlib.sha256(key_material.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(raw))

def encrypt_social_token(plain: str) -> str:
    if not plain:
        return ""
    return _fernet().encrypt(str(plain).encode("utf-8")).decode("utf-8")

def decrypt_social_token(token: str) -> str:
    if not token:
        return ""
    try:
        return _fernet().decrypt(str(token).encode("utf-8")).decode("utf-8")
    except Exception:
        # Fallback to sha256-derived key if primary fails
        try:
            raw = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
            return Fernet(base64.urlsafe_b64encode(raw)).decrypt(str(token).encode("utf-8")).decode("utf-8")
        except Exception:
            return ""

