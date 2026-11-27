import os
import re
import uuid
import base64
from typing import Optional, Tuple, Any, Dict

UPLOADS_DIR = os.path.abspath("uploads")

_DATA_IMAGE_RE = re.compile(r"^data:image/([a-zA-Z0-9.+-]+);base64,(.+)$", re.DOTALL)

def ensure_upload_dirs() -> None:
    os.makedirs(os.path.join(UPLOADS_DIR, "invoices"), exist_ok=True)
    os.makedirs(os.path.join(UPLOADS_DIR, "quotations"), exist_ok=True)
    os.makedirs(os.path.join(UPLOADS_DIR, "documents", "generated"), exist_ok=True)
    os.makedirs(os.path.join(UPLOADS_DIR, "documents", "submitted"), exist_ok=True)
    os.makedirs(os.path.join(UPLOADS_DIR, "signatures"), exist_ok=True)
    os.makedirs(os.path.join(UPLOADS_DIR, "employee"), exist_ok=True)


def save_base64_image(data_uri: str, subfolder: str = "signatures", prefix: str = "sig") -> Optional[str]:
    """Decodes a data:image/...;base64,... URI, saves it under uploads/<subfolder>/, and returns /uploads/<subfolder>/<filename>."""
    if not isinstance(data_uri, str):
        return None
    stripped = data_uri.strip()
    m = _DATA_IMAGE_RE.match(stripped)
    if not m:
        return None
    mime_sub, b64_payload = m.group(1).lower(), m.group(2).strip()
    ext_map = {"jpeg": "jpg", "jpg": "jpg", "png": "png", "webp": "webp", "gif": "gif", "svg+xml": "svg"}
    ext = ext_map.get(mime_sub, "png")
    try:
        raw_bytes = base64.b64decode(b64_payload, validate=False)
    except Exception:
        return None
    if not raw_bytes:
        return None

    folder_path = os.path.join(UPLOADS_DIR, subfolder)
    os.makedirs(folder_path, exist_ok=True)
    clean_prefix = "".join(c for c in str(prefix) if c.isalnum() or c in ("-", "_")) or "img"
    filename = f"{clean_prefix}_{uuid.uuid4().hex[:12]}.{ext}"
    full_path = os.path.join(folder_path, filename)
    with open(full_path, "wb") as f:
        f.write(raw_bytes)
    return f"/uploads/{subfolder}/{filename}"


def normalize_base64_images_in_dict(
    data: Any,
    default_subfolder: str = "signatures",
    prefix: str = "img",
    _cache: Optional[Dict[str, str]] = None,
) -> Any:
    """Recursively converts any data:image/...;base64,... string in a dict/list into a saved /uploads/... URL."""
    if _cache is None:
        _cache = {}
    if isinstance(data, dict):
        out = {}
        for k, v in data.items():
            sub = "employee" if k in ("profile_photo", "avatar") else default_subfolder
            if isinstance(v, str) and v.strip().startswith("data:image/"):
                key_str = f"{sub}:{v.strip()}"
                if key_str not in _cache:
                    saved = save_base64_image(v, subfolder=sub, prefix=f"{prefix}_{k}")
                    _cache[key_str] = saved if saved else v
                out[k] = _cache[key_str]
            elif isinstance(v, (dict, list)):
                out[k] = normalize_base64_images_in_dict(v, default_subfolder=default_subfolder, prefix=prefix, _cache=_cache)
            else:
                out[k] = v
        return out
    if isinstance(data, list):
        return [normalize_base64_images_in_dict(item, default_subfolder=default_subfolder, prefix=prefix, _cache=_cache) for item in data]
    return data

def save_pdf_file(pdf_bytes: bytes, filename: str, subfolder: str = "invoices") -> Tuple[str, str]:
    """
    Saves PDF bytes to disk and returns (file_path, pdf_url).
    """
    ensure_upload_dirs()
    folder_path = os.path.join(UPLOADS_DIR, subfolder)
    clean_filename = "".join(c for c in filename if c.isalnum() or c in ("-", "_", ".")).strip()
    if not clean_filename.endswith(".pdf"):
        clean_filename += ".pdf"

    full_path = os.path.join(folder_path, clean_filename)
    
    with open(full_path, "wb") as f:
        f.write(pdf_bytes)

    rel_path = os.path.relpath(full_path, start=os.getcwd()).replace("\\", "/")
    web_url = f"/uploads/{subfolder}/{clean_filename}"
    return rel_path, web_url

def delete_pdf_file(file_path: Optional[str]) -> bool:
    """
    Deletes old PDF file from disk if it exists.
    """
    if not file_path:
        return False
    try:
        abs_path = os.path.abspath(file_path)
        if os.path.exists(abs_path) and os.path.isfile(abs_path):
            os.remove(abs_path)
            return True
    except Exception as e:
        print(f"Error deleting PDF file '{file_path}': {e}")
    return False
