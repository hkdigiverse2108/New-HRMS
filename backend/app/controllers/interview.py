from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Dict, Any, Optional
from app.schemas.pagination import PaginatedResponse
from app.schemas.interview import (
    InterviewStageCreate, InterviewStageUpdate, InterviewStageResponse,
    InterviewScheduleCreate, InterviewScheduleUpdate, InterviewScheduleResponse
)
from app.services.interview import InterviewService
from app.controllers.auth import get_current_employee

router = APIRouter(prefix="/interviews", tags=["Interviews & Recruitment"])

# ==================== INTERVIEW STAGES ====================

@router.post("/stages", response_model=InterviewStageResponse, status_code=status.HTTP_201_CREATED)
async def create_interview_stage(
    data: InterviewStageCreate,
    current_user: dict = Depends(get_current_employee)
):
    """Create a new dynamic interview stage (e.g. Screening, Technical Round)."""
    return await InterviewService.create_stage(data, current_user)

@router.get("/stages", response_model=List[InterviewStageResponse])
async def get_all_interview_stages(
    current_user: dict = Depends(get_current_employee)
):
    """Get list of all active interview stages."""
    return await InterviewService.get_all_stages(current_user)

@router.get("/stages/{stage_id}", response_model=InterviewStageResponse)
async def get_interview_stage_by_id(
    stage_id: str,
    current_user: dict = Depends(get_current_employee)
):
    """Get single interview stage by ID."""
    return await InterviewService.get_stage_by_id(stage_id, current_user)

@router.put("/stages/{stage_id}", response_model=InterviewStageResponse)
async def update_interview_stage(
    stage_id: str,
    data: InterviewStageUpdate,
    current_user: dict = Depends(get_current_employee)
):
    """Update an interview stage's details."""
    return await InterviewService.update_stage(stage_id, data, current_user)

@router.delete("/stages/{stage_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_interview_stage(
    stage_id: str,
    current_user: dict = Depends(get_current_employee)
):
    """Delete an interview stage (Soft delete)."""
    success = await InterviewService.delete_stage(stage_id, current_user)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete interview stage")

# ==================== INTERVIEW SCHEDULES ====================

@router.post("/schedules", response_model=InterviewScheduleResponse, status_code=status.HTTP_201_CREATED)
async def schedule_interview(
    data: InterviewScheduleCreate,
    current_user: dict = Depends(get_current_employee)
):
    """
    Schedule a new interview for a candidate. 
    Role position can be an actual hiring job or a static 'General Application'.
    """
    return await InterviewService.create_schedule(data, current_user)

@router.get("/schedules", response_model=PaginatedResponse[InterviewScheduleResponse])
async def get_all_interview_schedules(
    search: Optional[str] = Query(None, description="Search candidate name, interviewer, role"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(100, ge=1, description="Items per page"),
    current_user: dict = Depends(get_current_employee)
):
    """
    Get paginated list of interview schedules.
    """
    return await InterviewService.get_all_schedules(
        current_user=current_user,
        search=search,
        page=page,
        limit=limit
    )

@router.get("/schedules/{schedule_id}", response_model=InterviewScheduleResponse)
async def get_interview_schedule_by_id(
    schedule_id: str,
    current_user: dict = Depends(get_current_employee)
):
    """Get single interview schedule details."""
    return await InterviewService.get_schedule_by_id(schedule_id, current_user)

@router.put("/schedules/{schedule_id}", response_model=InterviewScheduleResponse)
async def update_interview_schedule(
    schedule_id: str,
    data: InterviewScheduleUpdate,
    current_user: dict = Depends(get_current_employee)
):
    """Update interview schedule (e.g. change status, date, time)."""
    return await InterviewService.update_schedule(schedule_id, data, current_user)

@router.delete("/schedules/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_interview_schedule(
    schedule_id: str,
    current_user: dict = Depends(get_current_employee)
):
    """Delete an interview schedule (Soft delete)."""
    success = await InterviewService.delete_schedule(schedule_id, current_user)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete interview schedule")
