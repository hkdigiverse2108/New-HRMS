from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.responses import StreamingResponse
import httpx
from typing import Optional, List
from app.schemas.gallery import (
    GalleryEventCreate, GalleryEventUpdate, GalleryEventResponse, GalleryPaginatedResponse
)
from app.services.gallery import GalleryService
from app.controllers.auth import get_current_employee

router = APIRouter(prefix="/gallery", tags=["Gallery & Events"])

@router.get("/stream-video")
async def stream_gallery_video(url: str, request: Request):
    """
    Proxies video streaming for Google Photos / Drive videos without Referer / CORS issues,
    supporting HTTP Range headers for smooth playback and seeking in HTML5 <video>.
    """
    if not url:
        raise HTTPException(status_code=400, detail="Missing url")
    
    clean_url = url.strip()
    if "lh3.googleusercontent.com" in clean_url and not any(clean_url.endswith(s) for s in ["=m18", "=m22", "=m37"]):
        clean_url = clean_url.split("=")[0] + "=m18"
    
    req_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*"
    }
    range_header = request.headers.get("range")
    if range_header:
        req_headers["Range"] = range_header

    client = httpx.AsyncClient(timeout=60.0, follow_redirects=True)
    req = client.build_request("GET", clean_url, headers=req_headers)
    resp = await client.send(req, stream=True)

    resp_headers = {}
    for h in ["content-type", "content-length", "content-range", "accept-ranges"]:
        if h in resp.headers:
            resp_headers[h] = resp.headers[h]
    resp_headers["access-control-allow-origin"] = "*"

    async def body_stream():
        try:
            async for chunk in resp.aiter_bytes():
                yield chunk
        finally:
            await resp.aclose()
            await client.aclose()

    return StreamingResponse(
        body_stream(),
        status_code=resp.status_code,
        headers=resp_headers,
        media_type=resp.headers.get("content-type", "video/mp4")
    )


@router.post("", response_model=GalleryEventResponse, status_code=status.HTTP_201_CREATED)
async def create_gallery_event(
    data: GalleryEventCreate,
    current_user: dict = Depends(get_current_employee)
):
    """Create a new Gallery Event item (Requires 'create' permission)."""
    return await GalleryService.create_event(data, current_user)

@router.get("", response_model=GalleryPaginatedResponse)
async def get_all_gallery_events(
    search: Optional[str] = Query(None, description="Search by event name, link, or date"),
    date: Optional[str] = Query(None, description="Filter by exact or partial date (e.g. 05-10-2026)"),
    start_date: Optional[str] = Query(None, description="Filter by range start date (e.g. 2026-10-01)"),
    end_date: Optional[str] = Query(None, description="Filter by range end date (e.g. 2026-10-31)"),
    page: int = Query(1, ge=1, description="Page number (default: 1)"),
    limit: int = Query(10, ge=1, le=100, description="Items per page (default: 10, max: 100)"),
    current_user: dict = Depends(get_current_employee)
):
    """
    Get all gallery events with date filters and pagination (Requires 'read' permission).
    """
    return await GalleryService.get_all_events(
        current_user,
        search=search,
        date=date,
        start_date=start_date,
        end_date=end_date,
        page=page,
        limit=limit
    )

@router.get("/{item_id}", response_model=GalleryEventResponse)
async def get_gallery_event_by_id(
    item_id: str,
    current_user: dict = Depends(get_current_employee)
):
    """Get a single gallery event by ID (Requires 'read' permission)."""
    item = await GalleryService.get_by_id(item_id, current_user)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gallery event not found")
    return item

@router.put("/{item_id}", response_model=GalleryEventResponse)
async def update_gallery_event(
    item_id: str,
    data: GalleryEventUpdate,
    current_user: dict = Depends(get_current_employee)
):
    """Update a gallery event (Requires 'edit' permission)."""
    return await GalleryService.update_event(item_id, data, current_user)

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_gallery_event(
    item_id: str,
    current_user: dict = Depends(get_current_employee)
):
    """Delete a gallery event (Requires 'delete' permission)."""
    success = await GalleryService.delete_event(item_id, current_user)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete gallery event")
