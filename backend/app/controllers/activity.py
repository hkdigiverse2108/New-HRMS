from fastapi import APIRouter, Depends, Query, Request
from app.schemas.activity import ActivityLogResponse
from app.schemas.pagination import PaginatedResponse
from app.services.activity import ActivityService
from app.controllers.auth import get_current_employee
from typing import Optional, Dict, Any
from pydantic import BaseModel

router = APIRouter(tags=["Activity Logs"])

class CreateActivityLogRequest(BaseModel):
    action: str
    category: str = "System"
    severity: str = "Info"
    description: Optional[str] = None
    metadata: Optional[str] = None

@router.get("/activity-logs")
@router.get("/activities")
async def get_system_activity_logs(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(25, ge=1, le=100, description="Items per page"),
    category: Optional[str] = Query(None, description="Category filter (All, Auth, People, Work, Sales, Payroll, Finance, System)"),
    severity: Optional[str] = Query(None, description="Severity filter (All, Info, Warning, Critical)"),
    user_name: Optional[str] = Query(None, description="Filter by user name or ID"),
    department: Optional[str] = Query(None, description="Filter by department"),
    role: Optional[str] = Query(None, description="Filter by role"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    action_type: Optional[str] = Query(None, description="Filter by action name/type"),
    search: Optional[str] = Query(None, description="Search term across all fields"),
    sort_order: Optional[str] = Query("desc", description="Sort order (desc or asc)"),
    current_user: dict = Depends(get_current_employee)
):
    return await ActivityService.get_system_activities(
        current_user=current_user,
        page=page,
        limit=limit,
        category=category,
        severity=severity,
        user_name=user_name,
        department=department,
        role=role,
        start_date=start_date,
        end_date=end_date,
        action_type=action_type,
        search=search,
        sort_order=sort_order or "desc"
    )

@router.post("/activity-logs")
async def create_activity_log(
    req: CreateActivityLogRequest,
    request: Request,
    current_user: dict = Depends(get_current_employee)
):
    p = current_user.get("personal_info", {})
    w = current_user.get("work_details", {})
    name = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip() or current_user.get("name") or "User"
    role = w.get("system_role", "Employee")
    dept = w.get("department", "Development")
    emp_id = str(current_user.get("_id") or current_user.get("id") or "")
    avatar = p.get("profile_photo", "") or current_user.get("profile_photo", "")

    client_ip = request.client.host if request.client else "127.0.0.1"

    created = await ActivityService.log_system_activity(
        action=req.action,
        category=req.category,
        severity=req.severity,
        description=req.description or req.action,
        performed_by_id=emp_id,
        performed_by_name=name,
        performed_by_role=role,
        performed_by_department=dept,
        performed_by_avatar=avatar,
        metadata=req.metadata,
        ip=client_ip
    )
    return created

# Project-specific activities endpoint
@router.get("/projects/{project_id}/activities", response_model=PaginatedResponse[ActivityLogResponse])
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
