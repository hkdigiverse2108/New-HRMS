from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, List
from app.schemas.gallery import (
    GalleryEventCreate, GalleryEventUpdate, GalleryEventResponse, GalleryPaginatedResponse
)
from app.services.gallery import GalleryService
from app.controllers.auth import get_current_employee

router = APIRouter(prefix="/gallery", tags=["Gallery & Events"])

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
