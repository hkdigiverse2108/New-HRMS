import os
import shutil
import uuid
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, Query, HTTPException, status
from app.config import ROOT_DIR
from app.redis.service import get_cache, set_cache, clear_pattern, make_list_key
from app.database.db import get_database

# Root unified uploads storage directory (single folder with subfolders)
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
IMAGES_DIR = UPLOADS_DIR # Backward-compatibility alias

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"}
DOC_EXTENSIONS = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt"}
MEDIA_EXTENSIONS = {".mp4", ".webm", ".mp3", ".wav", ".ogg"}
ALLOWED_EXTENSIONS = IMAGE_EXTENSIONS | DOC_EXTENSIONS | MEDIA_EXTENSIONS

router = APIRouter(prefix="/images", tags=["Uploads"])
upload_router = APIRouter(tags=["Uploads"])

def get_safe_folder(folder: Optional[str]) -> str:
    """Sanitize folder name to prevent directory traversal and ensure clean POSIX naming."""
    if not folder:
        return "common"
    clean = "".join(c for c in folder if c.isalnum() or c in ("-", "_")).strip().lower()
    return clean if clean else "common"

@upload_router.post("/upload")
@upload_router.post("/uploads/upload")
@upload_router.post("/api/uploads/upload")
@router.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    folder: Optional[str] = Form(None)
):
    """
    Generic media upload API.
    Saves files inside ROOT_DIR / 'uploads' / <folder> (e.g. 'employee', 'department', 'chat_documents', etc.)
    Auto-creates the subfolder if it does not exist.
    """
    folder_name = get_safe_folder(folder)
    target_dir = UPLOADS_DIR / folder_name
    target_dir.mkdir(parents=True, exist_ok=True)

    file_ext = Path(file.filename or "").suffix.lower()
    if not file_ext or file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file format. Allowed formats: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    unique_filename = f"{folder_name}_{uuid.uuid4().hex[:12]}{file_ext}"
    dest_path = target_dir / unique_filename

    try:
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}"
        )
    finally:
        file.file.close()

    # Invalidate images and uploads cache
    await clear_pattern("images:*")
    await clear_pattern("uploads:*")

    # POSIX relative url (unified /uploads/ path)
    file_url = f"/uploads/{folder_name}/{unique_filename}"

    return {
        "status": "success",
        "url": file_url,
        "file_url": file_url,
        "filename": unique_filename,
        "folder": folder_name,
        "size": dest_path.stat().st_size
    }

@router.get("")
@router.get("/")
@router.get("/list")
@upload_router.get("/api/images/list")
@upload_router.get("/images-list")
@upload_router.get("/uploads/list")
@upload_router.get("/api/uploads/list")
@upload_router.get("/uploads-list")
async def list_images(
    folder: Optional[str] = Query(None, description="Folder name (e.g. 'employee')")
):
    """
    Returns list of all uploaded files/images, optionally filtered by folder.
    Used for image selection & reuse in frontend.
    """
    cache_key = make_list_key("uploads:list", folder=folder)
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    results = []
    
    if folder and folder.strip().lower() not in ("all", "", "none"):
        folder_name = get_safe_folder(folder)
        sub_dirs = [UPLOADS_DIR / folder_name]
    else:
        # Get all subdirectories + root
        sub_dirs = [d for d in UPLOADS_DIR.iterdir() if d.is_dir()]
        sub_dirs.append(UPLOADS_DIR)

    for dir_path in sub_dirs:
        if not dir_path.exists():
            continue
        rel_folder = dir_path.name if dir_path != UPLOADS_DIR else ""
        for file_path in dir_path.iterdir():
            if file_path.is_file() and file_path.suffix.lower() in ALLOWED_EXTENSIONS:
                stat = file_path.stat()
                ext = file_path.suffix.lower()
                if ext in IMAGE_EXTENSIONS:
                    ftype = "image"
                elif ext == ".pdf":
                    ftype = "pdf"
                elif ext in {".doc", ".docx", ".txt", ".xls", ".xlsx"}:
                    ftype = "doc"
                elif ext in {".mp4", ".webm"}:
                    ftype = "video"
                elif ext in {".mp3", ".wav", ".ogg"}:
                    ftype = "audio"
                else:
                    ftype = "other"

                url_path = f"/uploads/{rel_folder}/{file_path.name}" if rel_folder else f"/uploads/{file_path.name}"
                results.append({
                    "filename": file_path.name,
                    "url": url_path,
                    "folder": rel_folder or "root",
                    "size": stat.st_size,
                    "created_at": stat.st_mtime,
                    "file_type": ftype
                })

    # Sort newest first
    results.sort(key=lambda x: x["created_at"], reverse=True)

    res = {
        "status": "success",
        "total": len(results),
        "data": results
    }
    await set_cache(cache_key, res, ttl=60)
    return res

@router.delete("")
@router.delete("/")
@upload_router.delete("/images/delete")
@upload_router.delete("/api/images/delete")
@upload_router.delete("/uploads/delete")
@upload_router.delete("/api/uploads/delete")
async def delete_image(
    url: str = Query(..., description="File URL or relative path (e.g. /uploads/employee/xyz.png)")
):
    """Deletes an uploaded file from the storage folder."""
    if not url or not str(url).strip():
        return {"status": "skipped", "message": "No URL provided"}

    clean_url = str(url).replace("\\", "/").strip()

    # Skip external avatar placeholders
    if "ui-avatars.com" in clean_url or "dicebear.com" in clean_url:
        return {"status": "skipped", "message": "External placeholder ignored"}

    # Strip scheme and host if present
    if "://" in clean_url:
        clean_url = clean_url.split("://", 1)[1]
        clean_url = clean_url.split("/", 1)[1] if "/" in clean_url else ""

    clean_url = clean_url.strip("/")
    parts = [p for p in clean_url.split("/") if p and p != ".."]
    if parts and parts[0] in ("images", "uploads"):
        parts = parts[1:]

    if not parts:
        return {"status": "skipped", "message": "Invalid path"}

    file_path = UPLOADS_DIR.joinpath(*parts)

    # If single filename provided without folder, search under common subfolders
    if not file_path.exists() and len(parts) == 1:
        emp_path = UPLOADS_DIR / "employee" / parts[0]
        if emp_path.exists():
            file_path = emp_path

    if file_path.exists() and file_path.is_file():
        try:
            file_path.unlink()
            await clear_pattern("images:*")
            await clear_pattern("uploads:*")
            return {"status": "success", "message": "File deleted successfully"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")

    return {"status": "skipped", "message": "File not found or already deleted"}

@upload_router.post("/api/migrations/images-to-uploads")
@upload_router.get("/api/migrations/images-to-uploads")
async def trigger_uploads_migration():
    """Manually triggers migration of disk files from images/ to uploads/ and DB references."""
    from app.database.migration_uploads import run_uploads_and_disk_migration
    db = get_database()
    result = await run_uploads_and_disk_migration(db)
    return result
