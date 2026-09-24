from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from app.schemas.daily_progress import DailyProgressCreate, DailyProgressUpdate, DailyProgressApprove, DailyProgressResponse, DailyProgressStats
from app.services.daily_progress import DailyProgressService
from app.controllers.auth import get_current_employee

router = APIRouter(prefix="/daily-progress", tags=["Daily Progress"])



@router.get("/today", response_model=DailyProgressResponse)
async def get_today_progress(current_user: dict = Depends(get_current_employee)):
    return await DailyProgressService.get_today_progress(current_user)

@router.get("/average-rating", response_model=DailyProgressStats)
async def get_average_rating(
    time_range: Optional[str] = Query(None, description="all_time, today, yesterday, last_week, this_month, last_month, custom_range"),
    from_date: Optional[str] = Query(None, description="Start date for custom range (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="End date for custom range (YYYY-MM-DD)"),
    employee_id: Optional[str] = Query(None),
    view_type: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_employee)
):
    return await DailyProgressService.get_stats(current_user, time_range, from_date, to_date, employee_id, view_type)

@router.get("", response_model=List[DailyProgressResponse])
async def get_all_progress(
    search: Optional[str] = Query(None, description="Search by employee name"),
    employee_id: Optional[str] = Query(None, description="Filter by specific employee ID"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (pending_verification, approved, rejected, all_statuses)"),
    date: Optional[str] = Query(None, description="Specific date (YYYY-MM-DD)"),
    from_date: Optional[str] = Query(None, description="Start date for custom range (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="End date for custom range (YYYY-MM-DD)"),
    view_type: Optional[str] = Query(None, description="my or team"),
    current_user: dict = Depends(get_current_employee)
):
    return await DailyProgressService.get_all_progress(current_user, search, employee_id, status_filter, date, from_date, to_date, view_type)

@router.get("/{progress_id}", response_model=DailyProgressResponse)
async def get_progress_by_id(progress_id: str, current_user: dict = Depends(get_current_employee)):
    progress = await DailyProgressService.get_progress_by_id(progress_id, current_user)
    if not progress:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Daily progress not found or access denied")
    return progress

@router.put("/{progress_id}", response_model=DailyProgressResponse)
async def update_progress(progress_id: str, data: DailyProgressUpdate, current_user: dict = Depends(get_current_employee)):
    progress = await DailyProgressService.update_progress(progress_id, data, current_user)
    if not progress:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Progress not found, not in PENDING state, or access denied")
    return progress

@router.put("/{progress_id}/approve", response_model=DailyProgressResponse)
async def approve_progress(progress_id: str, data: DailyProgressApprove, current_user: dict = Depends(get_current_employee)):
    progress = await DailyProgressService.approve_progress(progress_id, data, current_user)
    if not progress:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Progress not found or access denied (Admin/HR only)")
    return progress

@router.put("/{progress_id}/reject", response_model=DailyProgressResponse)
async def reject_progress(progress_id: str, current_user: dict = Depends(get_current_employee)):
    progress = await DailyProgressService.reject_progress(progress_id, current_user)
    if not progress:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Progress not found or access denied (Admin/HR only)")
    return progress

@router.delete("/{progress_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_progress(progress_id: str, current_user: dict = Depends(get_current_employee)):
    success = await DailyProgressService.delete_progress(progress_id, current_user)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Progress not found or access denied (Admin/HR only)")
