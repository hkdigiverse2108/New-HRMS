import unicodedata
import re
from typing import Any

ZERO_WIDTH_CHARS = re.compile(r"[\u200B-\u200D\uFEFF]")
COLLAPSE_WS = re.compile(r"\s+")
MASK_TOKEN_PATTERNS = [
    (re.compile(r"(access_token=)[^&\s]+", re.IGNORECASE), r"\1***"),
    (re.compile(r"(Bearer\s+)[A-Za-z0-9_\-\.]+", re.IGNORECASE), r"\1***"),
    (re.compile(r"(x-goog-api-key:\s*)[^\s]+", re.IGNORECASE), r"\1***"),
    (re.compile(r"gsk_[A-Za-z0-9_]+"), "gsk_***"),
]

def norm(s: Any) -> str:
    """Normalise string for keyword comparison: NFKC -> drop zero-width -> collapse whitespace -> trim -> UPPERCASE."""
    if not s or not isinstance(s, str):
        return ""
    normalized = unicodedata.normalize("NFKC", s)
    cleaned = ZERO_WIDTH_CHARS.sub("", normalized)
    collapsed = COLLAPSE_WS.sub(" ", cleaned).strip()
    return collapsed.upper()

def clean_id(s: Any) -> str:
    """Clean media ID or IGSID: drop zero-width, trim leading/trailing apostrophes, trim."""
    if not s or not isinstance(s, str):
        return ""
    cleaned = ZERO_WIDTH_CHARS.sub("", s).strip()
    cleaned = cleaned.strip("'\"").strip()
    return cleaned

def to_bool(val: Any) -> bool:
    """Case-insensitive boolean converter for form and CSV values."""
    if isinstance(val, bool):
        return val
    if not val:
        return False
    s = str(val).strip().lower()
    return s in ("true", "1", "yes", "y", "t")

def mask(text: Any, max_len: int = 500) -> str:
    """Mask credentials and sensitive tokens from text strings."""
    if text is None:
        return ""
    s = str(text)
    for pattern, repl in MASK_TOKEN_PATTERNS:
        s = pattern.sub(repl, s)
    if len(s) > max_len:
        return s[:max_len] + "..."
    return s

def mask_dict(obj: Any, depth: int = 0) -> Any:
    """Recursively mask sensitive keys in dicts / lists before persisting to event logs."""
    if depth > 8:
        return "..."
    if isinstance(obj, dict):
        res = {}
        for k, v in obj.items():
            k_lower = str(k).lower()
            if any(secret in k_lower for secret in ("token", "password", "secret", "api_key", "authorization", "enc")):
                res[k] = "***"
            elif k_lower in ("igsid", "instagram_user_id", "recipient_id") and isinstance(v, str) and len(v) > 4:
                res[k] = f"...{v[-4:]}"
            else:
                res[k] = mask_dict(v, depth + 1)
        return res
    elif isinstance(obj, list):
        return [mask_dict(item, depth + 1) for item in obj]
    elif isinstance(obj, str):
        return mask(obj, max_len=500)
    return obj
