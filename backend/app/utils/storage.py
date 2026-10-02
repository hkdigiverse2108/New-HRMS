import os
from typing import Optional, Tuple

UPLOADS_DIR = os.path.abspath("uploads")

def ensure_upload_dirs() -> None:
    os.makedirs(os.path.join(UPLOADS_DIR, "invoices"), exist_ok=True)
    os.makedirs(os.path.join(UPLOADS_DIR, "quotations"), exist_ok=True)
    os.makedirs(os.path.join(UPLOADS_DIR, "documents", "generated"), exist_ok=True)
    os.makedirs(os.path.join(UPLOADS_DIR, "documents", "submitted"), exist_ok=True)

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
