from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, List
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectCategory, ProjectPriority, ProjectStatus, FollowUpLogCreate, FollowUpLog, ClientReviewCreate, ClientReviewUpdate, ClientReview
from app.schemas.pagination import PaginatedResponse
from app.services.project import ProjectService
from app.controllers.auth import get_current_employee

router = APIRouter(prefix="/projects", tags=["Projects"])

@router.get("/categories", response_model=list[str])
async def get_project_categories():
    return [c.value for c in ProjectCategory]

@router.get("/priorities", response_model=list[str])
async def get_project_priorities():
    return [p.value for p in ProjectPriority]

@router.post("", response_model=ProjectResponse, response_model_exclude_none=True, status_code=status.HTTP_201_CREATED)
async def create_project(data: ProjectCreate, current_user: dict = Depends(get_current_employee)):
    created = await ProjectService.create_project(data)
    return await ProjectService.get_project_by_id(created["_id"])

@router.get("", response_model=PaginatedResponse[ProjectResponse], response_model_exclude_none=True)
async def get_all_projects(
    page: Optional[int] = Query(None, ge=1, description="Page number"),
    limit: Optional[int] = Query(None, ge=1, description="Items per page"),
    client_id: Optional[str] = Query(None, description="Filter by client ID"),
    category: Optional[str] = Query(None, description="Filter by category (e.g. digital_marketing)"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    status: Optional[str] = Query(None, description="Filter by status (e.g. in_progress)"),
    search: Optional[str] = Query(None, description="Search term for project name"),
    whatsapp_status: Optional[str] = Query(None, description="Filter by whatsapp status (group_created, group_pending, greetings_sent, greetings_pending)"),
    festival_posts: Optional[bool] = Query(None, description="Filter by festival posts included"),
    has_content_calendar: Optional[bool] = Query(None, description="Filter by whether content calendar is created"),
    is_onhold: Optional[bool] = Query(None, description="Filter by project on-hold status"),
    followup_due: Optional[bool] = Query(None, description="Filter for projects where follow-up is currently due"),
    feedback_due: Optional[bool] = Query(None, description="Filter for projects where feedback is currently due"),
    cc_status: Optional[str] = Query(None, description="Filter by content calendar approval status (pending, approved_by_client, changes_requested, rejected)"),
    current_user: dict = Depends(get_current_employee)
):
    return await ProjectService.get_all_projects(
        is_deleted=False, 
        client_id=client_id,
        category=category,
        priority=priority,
        status=status,
        search=search,
        whatsapp_status=whatsapp_status,
        festival_posts=festival_posts,
        has_content_calendar=has_content_calendar,
        is_onhold=is_onhold,
        followup_due=followup_due,
        feedback_due=feedback_due,
        cc_status=cc_status,
        page=page, 
        limit=limit
    )

@router.get("/deleted", response_model=PaginatedResponse[ProjectResponse], response_model_exclude_none=True)
async def get_deleted_projects(
    page: Optional[int] = Query(None, ge=1),
    limit: Optional[int] = Query(None, ge=1),
    current_user: dict = Depends(get_current_employee)
):
    role = current_user.get("work_details", {}).get("system_role", "Employee")
    if role not in ["Admin", "Subadmin", "HR"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Admin/HR can view deleted projects")
        
    return await ProjectService.get_all_projects(is_deleted=True, page=page, limit=limit)

@router.get("/{project_id}", response_model=ProjectResponse, response_model_exclude_none=True)
async def get_project(project_id: str, current_user: dict = Depends(get_current_employee)):
    item = await ProjectService.get_project_by_id(project_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return item

@router.put("/{project_id}", response_model=ProjectResponse, response_model_exclude_none=True)
async def update_project(project_id: str, data: ProjectUpdate, current_user: dict = Depends(get_current_employee)):
    item = await ProjectService.get_project_by_id(project_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        
    updated = await ProjectService.update_project(project_id, data, current_user.get("id"))
    if not updated:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update project")
        
    return await ProjectService.get_project_by_id(project_id)

@router.post("/{project_id}/followups", response_model=FollowUpLog)
async def add_followup(project_id: str, data: FollowUpLogCreate, current_user: dict = Depends(get_current_employee)):
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    log = await ProjectService.add_followup_log(project_id, data, emp_id)
    if not log:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to add followup log or project not found")
    return log

@router.get("/{project_id}/followups", response_model=List[FollowUpLog])
async def get_followups(project_id: str, current_user: dict = Depends(get_current_employee)):
    return await ProjectService.get_followup_logs(project_id)

@router.post("/{project_id}/reviews", response_model=ClientReview)
async def add_client_review(project_id: str, data: ClientReviewCreate, current_user: dict = Depends(get_current_employee)):
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    review = await ProjectService.add_client_review(project_id, data, emp_id)
    if not review:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to add client review or project not found")
    return review

@router.put("/{project_id}/reviews/{review_id}/comment", response_model=ClientReview)
async def update_client_review_comment(project_id: str, review_id: str, data: ClientReviewUpdate, current_user: dict = Depends(get_current_employee)):
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    review = await ProjectService.update_client_review_comment(project_id, review_id, data, emp_id)
    if not review:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update comment or review not found")
    return review

@router.get("/{project_id}/reviews", response_model=List[ClientReview])
async def get_client_reviews(project_id: str, current_user: dict = Depends(get_current_employee)):
    return await ProjectService.get_client_reviews(project_id)

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: str, current_user: dict = Depends(get_current_employee)):
    item = await ProjectService.get_project_by_id(project_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        
    role = current_user.get("work_details", {}).get("system_role", "Employee")
    if role not in ["Admin", "Subadmin", "HR"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this project")
        
    success = await ProjectService.delete_project(project_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete project")

@router.delete("/{project_id}/campaigns/{campaign_name}", response_model=ProjectResponse, response_model_exclude_none=True)
async def delete_campaign(project_id: str, campaign_name: str, current_user: dict = Depends(get_current_employee)):
    item = await ProjectService.get_project_by_id(project_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        
    success = await ProjectService.remove_campaign(project_id, campaign_name)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete campaign or campaign not found")
        
    return await ProjectService.get_project_by_id(project_id)
