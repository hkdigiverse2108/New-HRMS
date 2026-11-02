import os
import shutil
import logging
from pathlib import Path
from app.config import ROOT_DIR

logger = logging.getLogger(__name__)

def replace_images_path(val):
    """Recursively replaces /images/ with /uploads/ in strings, dicts, and lists."""
    if isinstance(val, str):
        if "/images/" in val:
            return val.replace("/images/", "/uploads/")
        if val.startswith("images/"):
            return "uploads/" + val[7:]
        return val
    elif isinstance(val, dict):
        return {k: replace_images_path(v) for k, v in val.items()}
    elif isinstance(val, list):
        return [replace_images_path(item) for item in val]
    return val

async def run_uploads_and_disk_migration(db):
    """
    1. Copies any files/folders from ROOT_DIR/'images' into ROOT_DIR/'uploads' on disk.
    2. Migrates MongoDB records containing '/images/' to '/uploads/'.
    Idempotent and safe to run on every startup.
    """
    uploads_dir = ROOT_DIR / "uploads"
    images_dir = ROOT_DIR / "images"
    uploads_dir.mkdir(parents=True, exist_ok=True)

    # 1. Disk migration
    try:
        if images_dir.exists() and images_dir.is_dir() and images_dir.resolve() != uploads_dir.resolve():
            for item in images_dir.iterdir():
                dest = uploads_dir / item.name
                if item.is_dir():
                    dest.mkdir(parents=True, exist_ok=True)
                    for sub_item in item.rglob("*"):
                        if sub_item.is_file():
                            rel = sub_item.relative_to(item)
                            sub_dest = dest / rel
                            sub_dest.parent.mkdir(parents=True, exist_ok=True)
                            if not sub_dest.exists() or sub_dest.stat().st_size == 0:
                                try:
                                    shutil.copy2(sub_item, sub_dest)
                                except Exception as e:
                                    logger.warning(f"Could not copy {sub_item} to {sub_dest}: {e}")
                elif item.is_file():
                    if not dest.exists() or dest.stat().st_size == 0:
                        try:
                            shutil.copy2(item, dest)
                        except Exception as e:
                            logger.warning(f"Could not copy {item} to {dest}: {e}")
            logger.info("[MIGRATION] Disk files synchronized from images/ to uploads/ successfully.")
    except Exception as e:
        logger.error(f"[MIGRATION ERROR] Disk migration issue: {e}")

    # 2. Database migration
    if db is None:
        return {"status": "skipped", "reason": "No database connection"}

    total_migrated = 0
    try:
        collections = await db.list_collection_names()
        for col_name in collections:
            if col_name.startswith("system."):
                continue
            cursor = db[col_name].find({})
            async for doc in cursor:
                doc_str = str(doc)
                if "/images/" in doc_str or '"images/' in doc_str or "'images/" in doc_str:
                    doc_id = doc["_id"]
                    new_doc = replace_images_path(doc)
                    new_doc_clean = {k: v for k, v in new_doc.items() if k != "_id"}
                    await db[col_name].update_one({"_id": doc_id}, {"$set": new_doc_clean})
                    total_migrated += 1

        if total_migrated > 0:
            logger.info(f"[MIGRATION] Successfully updated {total_migrated} documents from /images/ to /uploads/ in MongoDB.")
            from app.redis.service import clear_pattern
            await clear_pattern("employees:*")
            await clear_pattern("projects:*")
            await clear_pattern("clients:*")
            await clear_pattern("images:*")
            await clear_pattern("uploads:*")
    except Exception as e:
        logger.error(f"[MIGRATION ERROR] Database migration issue: {e}")

    return {"status": "success", "total_migrated": total_migrated}

