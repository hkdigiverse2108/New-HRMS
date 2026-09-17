from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, List
from datetime import timedelta
from app.schemas.content import (
    ContentItemCreate, 
    ContentItemUpdate, 
    ContentItemResponse, 
    ContentTimelineSettings, 
    BulkAddRequest,
    ContentCalendarResponse
)
from app.schemas.pagination import PaginatedResponse
from app.services.content import ContentService
from app.controllers.auth import get_current_employee

router = APIRouter(prefix="/projects", tags=["Content Calendar"])

@router.get("/{project_id}/content/settings", response_model=ContentTimelineSettings)
async def get_content_settings(
    project_id: str,
    current_user: dict = Depends(get_current_employee)
):
    return await ContentService.get_settings(project_id)

@router.put("/{project_id}/content/settings", response_model=ContentTimelineSettings)
async def update_content_settings(
    project_id: str,
    settings: ContentTimelineSettings,
    current_user: dict = Depends(get_current_employee)
):
    if settings.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Project ID mismatch")
    return await ContentService.update_settings(project_id, settings)

@router.post("/{project_id}/content", response_model=ContentItemResponse, status_code=status.HTTP_201_CREATED)
async def create_content_item(
    project_id: str, 
    data: ContentItemCreate, 
    current_user: dict = Depends(get_current_employee)
):
    if data.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Project ID mismatch")
        
    created = await ContentService.create_content(project_id, data)
    if not created:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        
    return await ContentService.get_content_by_id(created["_id"])

@router.post("/{project_id}/content/bulk", response_model=List[ContentItemResponse], status_code=status.HTTP_201_CREATED)
async def bulk_add_content_items(
    project_id: str,
    data: BulkAddRequest,
    current_user: dict = Depends(get_current_employee)
):
    target_dates = []
    
    if data.specific_dates:
        target_dates.extend(data.specific_dates)
        
    if data.date_range:
        current_date = data.date_range.start_date
        end_date = data.date_range.end_date
        while current_date <= end_date:
            if current_date.weekday() in data.date_range.weekdays:
                target_dates.append(current_date)
            current_date += timedelta(days=1)
            
    if not target_dates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid dates provided for bulk add")
        
    # Remove duplicates and sort
    target_dates = sorted(list(set(target_dates)))
    
    created_items = []
    for dt in target_dates:
        new_item = ContentItemCreate(
            project_id=project_id,
            schedule_date=dt,
            content_type=data.default_format,
            topic_title="Untitled Idea"
        )
        created = await ContentService.create_content(project_id, new_item)
        if created:
            item = await ContentService.get_content_by_id(created["_id"])
            if item:
                created_items.append(item)
                
    return created_items

@router.get("/{project_id}/content", response_model=ContentCalendarResponse)
async def get_all_content_items(
    project_id: str,
    page: Optional[int] = Query(None, ge=1, description="Page number"),
    limit: Optional[int] = Query(None, ge=1, description="Items per page"),
    content_type: Optional[List[str]] = Query(None, description="Filter by Content Type(s)"),
    status: Optional[List[str]] = Query(None, description="Filter by Approval Status(es)"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Filter by month (1-12)"),
    year: Optional[int] = Query(None, description="Filter by year (e.g., 2026)"),
    start_date: Optional[str] = Query(None, description="Filter by start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Filter by end date (YYYY-MM-DD)"),
    current_user: dict = Depends(get_current_employee)
):
    STATUS_MAP = {
        "inprogress": "In Progress",
        "inreview": "In Review",
        "approved": "Approved",
        "published": "Published",
        "cancelled": "Cancelled"
    }
    TYPE_MAP = {
        "reel": "Reel",
        "post": "Post",
        "story": "Story"
    }
    
    if content_type:
        content_type = [TYPE_MAP.get(v.lower(), v.title()) for v in content_type]
    if status:
        status = [STATUS_MAP.get(v.lower(), v.title()) for v in status]
        
    return await ContentService.get_all_content(
        project_id=project_id,
        content_type=content_type,
        status=status,
        month=month,
        year=year,
        start_date=start_date,
        end_date=end_date,
        page=page,
        limit=limit
    )

@router.get("/{project_id}/content/{content_id}", response_model=ContentItemResponse)
async def get_content_item_by_id(
    project_id: str,
    content_id: str,
    current_user: dict = Depends(get_current_employee)
):
    item = await ContentService.get_content_by_id(content_id)
    if not item or item.get("project_id") != project_id or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content item not found")
        
    return item

@router.put("/{project_id}/content/{content_id}", response_model=ContentItemResponse)
async def update_content_item(
    project_id: str,
    content_id: str,
    data: ContentItemUpdate,
    current_user: dict = Depends(get_current_employee)
):
    item = await ContentService.get_content_by_id(content_id)
    if not item or item.get("project_id") != project_id or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content item not found")
        
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    updated = await ContentService.update_content(content_id, data, current_user_id=emp_id)
    
    if not updated:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update content item")
        
    return await ContentService.get_content_by_id(content_id)

@router.delete("/{project_id}/content/{content_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_content_item(
    project_id: str,
    content_id: str,
    current_user: dict = Depends(get_current_employee)
):
    item = await ContentService.get_content_by_id(content_id)
    if not item or item.get("project_id") != project_id or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content item not found")
        
    success = await ContentService.delete_content(content_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete content item")
