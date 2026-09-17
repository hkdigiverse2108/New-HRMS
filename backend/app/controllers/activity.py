from fastapi import APIRouter, Depends, Query
from app.schemas.activity import ActivityLogResponse
from app.schemas.pagination import PaginatedResponse
from app.services.activity import ActivityService
from app.controllers.auth import get_current_employee

router = APIRouter(prefix="/projects", tags=["Project Activity Logs"])

@router.get("/{project_id}/activities", response_model=PaginatedResponse[ActivityLogResponse])
async def get_project_activities(
    project_id: str,
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, description="Items per page"),
    current_user: dict = Depends(get_current_employee)
):
    return await ActivityService.get_project_activities(
        project_id=project_id,
        page=page,
        limit=limit
    )
