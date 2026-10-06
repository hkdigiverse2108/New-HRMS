import re
import urllib.request
from typing import List, Dict, Any, Tuple, Optional

VIDEO_EXTENSIONS = ('.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v', '.3gp', '.wmv')

def is_video_filename(filename: str) -> bool:
    if not filename:
        return False
    return filename.lower().strip().endswith(VIDEO_EXTENSIONS)

def extract_drive_file_id(url: str) -> Optional[str]:
    if not url:
        return None
    match = (
        re.search(r'/file/d/([a-zA-Z0-9_-]+)', url) or 
        re.search(r'[?&]id=([a-zA-Z0-9_-]+)', url) or 
        re.search(r'/d/([a-zA-Z0-9_-]+)', url) or
        re.search(r'thumbnail\?id=([a-zA-Z0-9_-]+)', url) or
        re.search(r'export=view&id=([a-zA-Z0-9_-]+)', url)
    )
    return match.group(1) if match else None

def fetch_media_from_google_drive_folder(folder_url: str) -> List[Dict[str, Any]]:
    """
    Extracts structured media items (file_id, name, media_type, url) for all files
    inside a public Google Drive folder via embeddedfolderview.
    Skips subfolders. Sets media_type = 'video' if filename ends with video extension.
    """
    if not folder_url:
        return []

    folder_id_match = (
        re.search(r'/folders/([a-zA-Z0-9_-]+)', folder_url) or 
        re.search(r'[?&]id=([a-zA-Z0-9_-]+)', folder_url)
    )
    if not folder_id_match:
        return []

    folder_id = folder_id_match.group(1)
    embed_url = f"https://drive.google.com/embeddedfolderview?id={folder_id}#grid"

    req = urllib.request.Request(
        embed_url, 
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
    )

    media_items: List[Dict[str, Any]] = []
    seen_file_ids = set()

    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            html = response.read().decode("utf-8", errors="ignore")

            # 1. Primary Extraction: Extract entries with flip-entry-title from HTML
            entry_matches = re.findall(
                r'id=["\']entry-([a-zA-Z0-9_-]+)["\'].*?class=["\']flip-entry-title["\']>([^<]+)<', 
                html, 
                re.DOTALL
            )
            
            if not entry_matches:
                entry_matches = re.findall(
                    r'class=["\']flip-entry[^"\']*["\'][^>]*data-id=["\']([a-zA-Z0-9_-]+)["\'].*?class=["\']flip-entry-title["\']>([^<]+)<', 
                    html, 
                    re.DOTALL
                )

            for fid, fname in entry_matches:
                if fid == folder_id or fid in seen_file_ids:
                    continue

                fname_clean = fname.strip()

                # Skip subfolders
                folder_block_check = re.search(
                    r'id=["\']entry-' + re.escape(fid) + r'["\'][^>]*class=["\'][^"\']*flip-entry-folder', 
                    html
                )
                if folder_block_check:
                    continue

                seen_file_ids.add(fid)
                mtype = "video" if is_video_filename(fname_clean) else "image"
                media_items.append({
                    "file_id": fid,
                    "name": fname_clean,
                    "media_type": mtype,
                    "url": f"https://drive.google.com/thumbnail?id={fid}&sz=w600"
                })

            # 2. Fallback Extraction (Keep old regex as fallback)
            if not media_items:
                for fid, fname in re.findall(r'\["([a-zA-Z0-9_-]+)",\s*"([^"]+\.[a-zA-Z0-9]{2,4})"', html):
                    if fid != folder_id and fid not in seen_file_ids:
                        seen_file_ids.add(fid)
                        fname_clean = fname.strip()
                        mtype = "video" if is_video_filename(fname_clean) else "image"
                        media_items.append({
                            "file_id": fid,
                            "name": fname_clean,
                            "media_type": mtype,
                            "url": f"https://drive.google.com/thumbnail?id={fid}&sz=w600"
                        })

                for fid in re.findall(r'/file/d/([a-zA-Z0-9_-]+)', html):
                    if fid != folder_id and fid not in seen_file_ids:
                        seen_file_ids.add(fid)
                        media_items.append({
                            "file_id": fid,
                            "name": fid,
                            "media_type": "image",
                            "url": f"https://drive.google.com/thumbnail?id={fid}&sz=w600"
                        })

                for fid in re.findall(r'thumbnail\?id=([a-zA-Z0-9_-]+)', html):
                    if fid != folder_id and fid not in seen_file_ids:
                        seen_file_ids.add(fid)
                        media_items.append({
                            "file_id": fid,
                            "name": fid,
                            "media_type": "image",
                            "url": f"https://drive.google.com/thumbnail?id={fid}&sz=w600"
                        })

    except Exception as e:
        print(f"[GoogleDriveParser] Error fetching folder '{folder_id}': {e}")

    return media_items


def fetch_images_from_google_drive_folder(folder_url: str) -> List[str]:
    """
    Backwards compatibility helper returning List[str] thumbnail URLs.
    """
    items = fetch_media_from_google_drive_folder(folder_url)
    return [item["url"] for item in items]


def fetch_images_from_google_photos_album(album_url: str) -> List[str]:
    """
    Extracts direct image URLs from a public Google Photos shared album URL.
    """
    if not album_url:
        return []

    req = urllib.request.Request(
        album_url, 
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            html = response.read().decode("utf-8", errors="ignore")

            pw_urls = re.findall(r'https://lh3\.googleusercontent\.com/pw/[a-zA-Z0-9_-]{50,}', html)
            all_urls = re.findall(r'https://lh3\.googleusercontent\.com/[a-zA-Z0-9_-]{60,}', html)

            raw_urls = pw_urls if pw_urls else all_urls

            valid_images = []
            for u in raw_urls:
                if any(bad in u for bad in ["/a/", "/a-/", "/ogw/", "proxy", "ggpht"]):
                    continue
                clean_u = u.split("=")[0] + "=w1200-h900"
                if clean_u not in valid_images:
                    valid_images.append(clean_u)

            return valid_images[:200]
    except Exception as e:
        print(f"[GooglePhotosParser] Error fetching album '{album_url}': {e}")
        return []


def auto_extract_gallery_media(
    link: Optional[str], 
    existing_images: Optional[List[str]] = None,
    existing_media_items: Optional[List[Dict[str, Any]]] = None
) -> Tuple[List[str], List[Dict[str, Any]]]:
    """
    Auto-detects link type and returns (images_list, media_items_list).
    Preserves existing media_items and backfills file_id, name, media_type for images.
    """
    images: List[str] = list(existing_images) if existing_images else []
    media_items: List[Dict[str, Any]] = list(existing_media_items) if existing_media_items else []

    url_to_media = {
        m.get("url"): m for m in media_items if isinstance(m, dict) and m.get("url")
    }

    if link and isinstance(link, str):
        str_link = link.strip()

        # 1. Google Drive Folder
        if "drive.google.com" in str_link and ("folder" in str_link or "folderview" in str_link):
            folder_items = fetch_media_from_google_drive_folder(str_link)
            for item in folder_items:
                u = item["url"]
                if u not in images:
                    images.append(u)
                if u not in url_to_media:
                    media_items.append(item)
                    url_to_media[u] = item

        # 2. Google Drive Single File
        elif "drive.google.com" in str_link:
            fid = extract_drive_file_id(str_link)
            if fid:
                u = f"https://drive.google.com/thumbnail?id={fid}&sz=w600"
                if u not in images:
                    images.append(u)
                if u not in url_to_media:
                    item = {
                        "file_id": fid,
                        "name": fid,
                        "media_type": "video" if is_video_filename(str_link) else "image",
                        "url": u
                    }
                    media_items.append(item)
                    url_to_media[u] = item

        # 3. Google Photos Shared Album
        elif "photos.google.com" in str_link or "photos.app.goo.gl" in str_link or "goo.gl/photos" in str_link:
            gp_images = fetch_images_from_google_photos_album(str_link)
            for u in gp_images:
                if u not in images:
                    images.append(u)
                if u not in url_to_media:
                    item = {
                        "file_id": None,
                        "name": "Google Photos Item",
                        "media_type": "image",
                        "url": u
                    }
                    media_items.append(item)
                    url_to_media[u] = item

        # 4. Direct Link(s)
        elif str_link.startswith("http://") or str_link.startswith("https://"):
            parts = re.split(r'[\n,]+', str_link) if ("," in str_link or "\n" in str_link) else [str_link]
            for p in parts:
                p_clean = p.strip()
                if p_clean and p_clean not in images:
                    images.append(p_clean)
                if p_clean and p_clean not in url_to_media:
                    fid = extract_drive_file_id(p_clean)
                    item = {
                        "file_id": fid,
                        "name": p_clean.split("/")[-1] or p_clean,
                        "media_type": "video" if is_video_filename(p_clean) else "image",
                        "url": p_clean
                    }
                    media_items.append(item)
                    url_to_media[p_clean] = item

    # Ensure all image strings in images array have a corresponding media_item dict
    for img_url in images:
        if img_url not in url_to_media:
            fid = extract_drive_file_id(img_url)
            item = {
                "file_id": fid,
                "name": fid or img_url.split("/")[-1],
                "media_type": "video" if is_video_filename(img_url) else "image",
                "url": img_url
            }
            media_items.append(item)
            url_to_media[img_url] = item

    return images, media_items


def auto_extract_gallery_images(link: str, existing_images: List[str] = None) -> List[str]:
    images, _ = auto_extract_gallery_media(link, existing_images)
    return images
