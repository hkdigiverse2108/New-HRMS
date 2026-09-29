from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, List
from datetime import date
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectCategory, ProjectPriority, ProjectStatus, FollowUpLogCreate, FollowUpLog, DailyMarketingStatCreate, DailyMarketingStatUpdate, DailyMarketingStat, MarketingCampaignCreate, DailyMarketingStatBulkCreate, MarketingSummaryResponse, DailyRevenueCreate, DailyRevenueUpdate, DailyRevenue, MarketingWorkspaceResponse
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

# K12: Client Reviews system removed (transcript — no requirement).

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

@router.post("/{project_id}/marketing-stats", response_model=DailyMarketingStat, status_code=status.HTTP_201_CREATED)
async def add_daily_marketing_stat(project_id: str, data: DailyMarketingStatCreate, current_user: dict = Depends(get_current_employee)):
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    stat = await ProjectService.add_daily_marketing_stat(project_id, data, emp_id)
    if not stat:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to add daily marketing stat or project not found")
    return stat

@router.post("/{project_id}/marketing-stats/bulk", response_model=List[DailyMarketingStat], status_code=status.HTTP_201_CREATED)
async def add_bulk_daily_marketing_stats(project_id: str, data: DailyMarketingStatBulkCreate, current_user: dict = Depends(get_current_employee)):
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    stats = await ProjectService.add_bulk_daily_marketing_stats(project_id, data, emp_id)
    if stats is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to bulk add marketing stats or project not found")
    return stats

@router.get("/{project_id}/marketing-stats", response_model=List[DailyMarketingStat])
async def get_daily_marketing_stats(
    project_id: str,
    campaign_name: Optional[str] = Query(None, description="Filter by campaign name"),
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    preset: Optional[str] = Query(None, description="Preset filter: today, yesterday, last_7_days, last_14_days, last_28_days, last_30_days, this_week, last_week, this_month, last_month, maximum"),
    current_user: dict = Depends(get_current_employee)
):
    stats = await ProjectService.get_daily_marketing_stats(project_id, campaign_name=campaign_name, start_date=start_date, end_date=end_date, preset=preset)
    if stats is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return stats

@router.get("/{project_id}/marketing-summary", response_model=MarketingSummaryResponse)
async def get_marketing_summary(
    project_id: str,
    campaign_name: Optional[str] = Query(None, description="Filter by campaign name"),
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    preset: Optional[str] = Query(None, description="Preset filter: today, yesterday, last_7_days, last_14_days, last_28_days, last_30_days, this_week, last_week, this_month, last_month, maximum"),
    current_user: dict = Depends(get_current_employee)
):
    summary = await ProjectService.get_marketing_summary(project_id, campaign_name=campaign_name, start_date=start_date, end_date=end_date, preset=preset)
    if summary is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return summary

@router.put("/{project_id}/marketing-stats/{stat_id}", response_model=DailyMarketingStat)
async def update_daily_marketing_stat(project_id: str, stat_id: str, data: DailyMarketingStatUpdate, current_user: dict = Depends(get_current_employee)):
    stat = await ProjectService.update_daily_marketing_stat(project_id, stat_id, data)
    if not stat:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update stat or stat not found")
    return stat

@router.delete("/{project_id}/marketing-stats/{stat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_daily_marketing_stat(project_id: str, stat_id: str, current_user: dict = Depends(get_current_employee)):
    success = await ProjectService.delete_daily_marketing_stat(project_id, stat_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete stat or stat not found")

@router.get("/{project_id}/marketing-campaigns", response_model=List[str])
async def get_marketing_campaigns(project_id: str, current_user: dict = Depends(get_current_employee)):
    campaigns = await ProjectService.get_marketing_campaigns(project_id)
    if campaigns is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return campaigns

@router.post("/{project_id}/marketing-campaigns", response_model=List[str], status_code=status.HTTP_201_CREATED)
async def add_marketing_campaign(project_id: str, data: MarketingCampaignCreate, current_user: dict = Depends(get_current_employee)):
    campaigns = await ProjectService.add_marketing_campaign(project_id, data.name)
    if campaigns is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to add campaign or project not found")
    return campaigns

@router.post("/{project_id}/daily-revenue", response_model=DailyRevenue, status_code=status.HTTP_201_CREATED)
async def add_daily_revenue(project_id: str, data: DailyRevenueCreate, current_user: dict = Depends(get_current_employee)):
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    revenue = await ProjectService.add_daily_revenue(project_id, data, emp_id)
    if not revenue:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to add daily revenue or project not found")
    return revenue

@router.get("/{project_id}/daily-revenue", response_model=List[DailyRevenue])
async def get_daily_revenues(
    project_id: str,
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    preset: Optional[str] = Query(None, description="Preset filter: today, yesterday, last_7_days, last_14_days, last_28_days, last_30_days, this_week, last_week, this_month, last_month, maximum"),
    current_user: dict = Depends(get_current_employee)
):
    revenues = await ProjectService.get_daily_revenues(project_id, start_date=start_date, end_date=end_date, preset=preset)
    if revenues is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return revenues

@router.put("/{project_id}/daily-revenue/{revenue_id}", response_model=DailyRevenue)
async def update_daily_revenue(project_id: str, revenue_id: str, data: DailyRevenueUpdate, current_user: dict = Depends(get_current_employee)):
    revenue = await ProjectService.update_daily_revenue(project_id, revenue_id, data)
    if not revenue:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update daily revenue or revenue not found")
    return revenue

@router.delete("/{project_id}/daily-revenue/{revenue_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_daily_revenue(project_id: str, revenue_id: str, current_user: dict = Depends(get_current_employee)):
    success = await ProjectService.delete_daily_revenue(project_id, revenue_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete daily revenue or revenue not found")

@router.get("/{project_id}/marketing-workspace", response_model=MarketingWorkspaceResponse)
async def get_marketing_workspace(
    project_id: str,
    campaign_name: Optional[str] = Query(None, description="Filter by campaign name"),
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    preset: Optional[str] = Query(None, description="Preset filter: today, yesterday, last_7_days, last_14_days, last_28_days, last_30_days, this_week, last_week, this_month, last_month, maximum"),
    current_user: dict = Depends(get_current_employee)
):
    workspace = await ProjectService.get_marketing_workspace(
        project_id, 
        campaign_name=campaign_name, 
        start_date=start_date, 
        end_date=end_date, 
        preset=preset
    )
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return workspace

