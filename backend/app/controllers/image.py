import os
import shutil
import uuid
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, Query, HTTPException, status
from app.config import ROOT_DIR

# Root images directory (outside frontend and backend)
IMAGES_DIR = ROOT_DIR / "images"
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"}

router = APIRouter(prefix="/images", tags=["Images"])
upload_router = APIRouter(tags=["Images"])

def get_safe_folder(folder: Optional[str]) -> str:
    """Sanitize folder name to prevent directory traversal and ensure clean POSIX naming."""
    if not folder:
        return "common"
    clean = "".join(c for c in folder if c.isalnum() or c in ("-", "_")).strip().lower()
    return clean if clean else "common"

@upload_router.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    folder: Optional[str] = Form(None)
):
    """
    Generic image upload API.
    Saves images inside ROOT_DIR / 'images' / <folder> (e.g. 'employee', 'department', etc.)
    Auto-creates the subfolder if it does not exist.
    """
    folder_name = get_safe_folder(folder)
    target_dir = IMAGES_DIR / folder_name
    target_dir.mkdir(parents=True, exist_ok=True)

    file_ext = Path(file.filename or "").suffix.lower()
    if not file_ext or file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid image format. Allowed formats: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    unique_filename = f"{folder_name}_{uuid.uuid4().hex[:12]}{file_ext}"
    dest_path = target_dir / unique_filename

    try:
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save image: {str(e)}"
        )
    finally:
        file.file.close()

    # POSIX relative url (e.g. /images/employee/employee_12345.png)
    file_url = f"/images/{folder_name}/{unique_filename}"

    return {
        "status": "success",
        "url": file_url,
        "filename": unique_filename,
        "folder": folder_name,
        "size": dest_path.stat().st_size
    }

@router.get("")
@router.get("/")
@router.get("/list")
@upload_router.get("/api/images/list")
@upload_router.get("/images-list")
async def list_images(
    folder: Optional[str] = Query(None, description="Folder name (e.g. 'employee')")
):
    """
    Returns list of all uploaded images, optionally filtered by folder.
    Used for image selection & reuse in frontend.
    """
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    results = []
    
    if folder:
        folder_name = get_safe_folder(folder)
        sub_dirs = [IMAGES_DIR / folder_name]
    else:
        # Get all subdirectories + root
        sub_dirs = [d for d in IMAGES_DIR.iterdir() if d.is_dir()]
        sub_dirs.append(IMAGES_DIR)

    for dir_path in sub_dirs:
        if not dir_path.exists():
            continue
        rel_folder = dir_path.name if dir_path != IMAGES_DIR else ""
        for file_path in dir_path.iterdir():
            if file_path.is_file() and file_path.suffix.lower() in ALLOWED_EXTENSIONS:
                stat = file_path.stat()
                url_path = f"/images/{rel_folder}/{file_path.name}" if rel_folder else f"/images/{file_path.name}"
                results.append({
                    "filename": file_path.name,
                    "url": url_path,
                    "folder": rel_folder or "root",
                    "size": stat.st_size,
                    "created_at": stat.st_mtime
                })

    # Sort newest first
    results.sort(key=lambda x: x["created_at"], reverse=True)

    return {
        "status": "success",
        "total": len(results),
        "data": results
    }

@router.delete("/")
async def delete_image(
    url: str = Query(..., description="Image URL or relative path (e.g. /images/employee/xyz.png)")
):
    """Deletes an image file from the images folder."""
    clean_url = url.replace("\\", "/").strip("/")
    # Clean leading 'images/' if present
    parts = [p for p in clean_url.split("/") if p and p != ".."]
    if parts and parts[0] == "images":
        parts = parts[1:]

    file_path = IMAGES_DIR.joinpath(*parts)
    
    if file_path.exists() and file_path.is_file():
        try:
            file_path.unlink()
            return {"status": "success", "message": "Image deleted successfully"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")
            
    raise HTTPException(status_code=404, detail="Image not found")
