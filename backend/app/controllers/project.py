from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, List
from datetime import date
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectCategory, ProjectPriority, ProjectStatus, FollowUpLogCreate, FollowUpLog, DailyMarketingStatCreate, DailyMarketingStatUpdate, DailyMarketingStat, MarketingCampaignCreate, DailyMarketingStatBulkCreate, MarketingSummaryResponse, DailyRevenueCreate, DailyRevenueUpdate, DailyRevenue, MarketingWorkspaceResponse, ProjectTaskSummaryResponse, ProjectRenewalCreate
from app.schemas.task import TaskCreate, TaskUpdate
from app.schemas.pagination import PaginatedResponse
from app.services.project import ProjectService
from app.controllers.auth import get_current_employee
from app.redis.service import get_cache, set_cache, clear_pattern, make_list_key

router = APIRouter(prefix="/projects", tags=["Projects"])

@router.post("/{project_id}/renew", response_model=ProjectResponse)
async def renew_project(project_id: str, data: ProjectRenewalCreate, current_user: dict = Depends(get_current_employee)):
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    updated = await ProjectService.renew_project(project_id, data, emp_id)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    await clear_pattern("projects:*")
    return updated

@router.get("/categories", response_model=list[str])
async def get_project_categories():
    return [c.value for c in ProjectCategory]

@router.get("/priorities", response_model=list[str])
async def get_project_priorities():
    return [p.value for p in ProjectPriority]

@router.post("", response_model=ProjectResponse, response_model_exclude_none=True, status_code=status.HTTP_201_CREATED)
async def create_project(data: ProjectCreate, current_user: dict = Depends(get_current_employee)):
    created = await ProjectService.create_project(data)
    await clear_pattern("projects:*")
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
    is_archived: Optional[bool] = Query(None, description="Filter by archived status"),
    current_user: dict = Depends(get_current_employee)
):
    work_details = current_user.get("work_details", {}) or {}
    user_role = str(current_user.get("role", "") or work_details.get("system_role", "") or current_user.get("system_role", "")).strip().lower()
    user_dept = str(current_user.get("department", "") or work_details.get("department", ""))
    is_operational = "operation" in user_dept.lower()
    is_admin_or_hr = user_role in ["admin", "superadmin", "hr", "subadmin"] or is_operational
    effective_category = category
    # Note: Removed forced filtering by user_dept so employees with project access/assignments
    # across multiple categories (e.g. Creative/CC, Development, Digital Marketing) can see their projects.

    cache_key = make_list_key(
        "projects",
        page=page,
        limit=limit,
        client_id=client_id,
        category=effective_category,
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
        is_archived=is_archived,
        role=user_role,
        dept=user_dept
    )
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    result = await ProjectService.get_all_projects(
        is_deleted=False, 
        client_id=client_id,
        category=effective_category,
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
        is_archived=is_archived,
        page=page, 
        limit=limit
    )
    await set_cache(cache_key, result, ttl=60)
    return result

@router.get("/deleted", response_model=PaginatedResponse[ProjectResponse], response_model_exclude_none=True)
async def get_deleted_projects(
    page: Optional[int] = Query(None, ge=1),
    limit: Optional[int] = Query(None, ge=1),
    current_user: dict = Depends(get_current_employee)
):
    role = current_user.get("work_details", {}).get("system_role", "Employee")
    if role not in ["Admin", "Subadmin", "HR"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Admin/HR can view deleted projects")

    cache_key = make_list_key("projects:deleted", page=page, limit=limit)
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    result = await ProjectService.get_all_projects(is_deleted=True, page=page, limit=limit)
    await set_cache(cache_key, result, ttl=60)
    return result

@router.get("/{project_id}", response_model=ProjectResponse, response_model_exclude_none=True)
async def get_project(project_id: str, current_user: dict = Depends(get_current_employee)):
    cache_key = f"projects:item:{project_id}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    item = await ProjectService.get_project_by_id(project_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    await set_cache(cache_key, item, ttl=120)
    return item

@router.put("/{project_id}", response_model=ProjectResponse, response_model_exclude_none=True)
async def update_project(project_id: str, data: ProjectUpdate, current_user: dict = Depends(get_current_employee)):
    item = await ProjectService.get_project_by_id(project_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    updated = await ProjectService.update_project(project_id, data, current_user_id=emp_id)
    if not updated:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update project")

    await clear_pattern("projects:*")
    return await ProjectService.get_project_by_id(project_id)

@router.post("/{project_id}/followups", response_model=FollowUpLog)
async def add_followup(project_id: str, data: FollowUpLogCreate, current_user: dict = Depends(get_current_employee)):
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    log = await ProjectService.add_followup_log(project_id, data, emp_id)
    if not log:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to add followup log or project not found")
    await clear_pattern(f"projects:{project_id}:*")
    return log

@router.get("/{project_id}/followups", response_model=List[FollowUpLog])
async def get_followups(project_id: str, current_user: dict = Depends(get_current_employee)):
    cache_key = f"projects:{project_id}:followups"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached
    result = await ProjectService.get_followup_logs(project_id)
    await set_cache(cache_key, result, ttl=60)
    return result

# K12: Client Reviews system removed (transcript — no requirement).

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: str, current_user: dict = Depends(get_current_employee)):
    item = await ProjectService.get_project_by_id(project_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        
    role = str(current_user.get("work_details", {}).get("system_role") or current_user.get("role") or "").strip().lower()
    if role not in ["admin", "superadmin", "subadmin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Admin can delete projects")
        
    success = await ProjectService.delete_project(project_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete project")
    await clear_pattern("projects:*")

@router.post("/{project_id}/archive", response_model=ProjectResponse, response_model_exclude_none=True)
async def archive_project(project_id: str, status: Optional[bool] = Query(None), current_user: dict = Depends(get_current_employee)):
    role = str(current_user.get("work_details", {}).get("system_role") or current_user.get("role") or "").strip().lower()
    if role not in ["admin", "superadmin", "subadmin"]:
        raise HTTPException(status_code=403, detail="Only administration can archive or unarchive projects.")
    item = await ProjectService.get_project_by_id(project_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=404, detail="Project not found")
    archive_status = True if status is None else status
    success = await ProjectService.archive_project(project_id, status=archive_status)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to archive project")
    await clear_pattern("projects:*")
    return await ProjectService.get_project_by_id(project_id)

@router.post("/{project_id}/unarchive", response_model=ProjectResponse, response_model_exclude_none=True)
async def unarchive_project(project_id: str, current_user: dict = Depends(get_current_employee)):
    role = str(current_user.get("work_details", {}).get("system_role") or current_user.get("role") or "").strip().lower()
    if role not in ["admin", "superadmin", "subadmin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only administration can archive or unarchive projects.")
    item = await ProjectService.get_project_by_id(project_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    success = await ProjectService.archive_project(project_id, status=False)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to unarchive project")
    await clear_pattern("projects:*")
    return await ProjectService.get_project_by_id(project_id)

@router.post("/{project_id}/marketing-stats", response_model=DailyMarketingStat, status_code=status.HTTP_201_CREATED)
async def add_daily_marketing_stat(project_id: str, data: DailyMarketingStatCreate, current_user: dict = Depends(get_current_employee)):
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    stat = await ProjectService.add_daily_marketing_stat(project_id, data, emp_id)
    if not stat:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to add daily marketing stat or project not found")
    await clear_pattern(f"projects:{project_id}:*")
    return stat

@router.post("/{project_id}/marketing-stats/bulk", response_model=List[DailyMarketingStat], status_code=status.HTTP_201_CREATED)
async def add_bulk_daily_marketing_stats(project_id: str, data: DailyMarketingStatBulkCreate, current_user: dict = Depends(get_current_employee)):
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    stats = await ProjectService.add_bulk_daily_marketing_stats(project_id, data, emp_id)
    if stats is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to bulk add marketing stats or project not found")
    await clear_pattern(f"projects:{project_id}:*")
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
    cache_key = make_list_key(
        f"projects:{project_id}:marketing_stats",
        campaign_name=campaign_name,
        start_date=start_date,
        end_date=end_date,
        preset=preset
    )
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    stats = await ProjectService.get_daily_marketing_stats(project_id, campaign_name=campaign_name, start_date=start_date, end_date=end_date, preset=preset)
    result = stats if stats is not None else []
    await set_cache(cache_key, result, ttl=60)
    return result

@router.get("/{project_id}/marketing-summary", response_model=MarketingSummaryResponse)
async def get_marketing_summary(
    project_id: str,
    campaign_name: Optional[str] = Query(None, description="Filter by campaign name"),
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    preset: Optional[str] = Query(None, description="Preset filter: today, yesterday, last_7_days, last_14_days, last_28_days, last_30_days, this_week, last_week, this_month, last_month, maximum"),
    current_user: dict = Depends(get_current_employee)
):
    cache_key = make_list_key(
        f"projects:{project_id}:marketing_summary",
        campaign_name=campaign_name,
        start_date=start_date,
        end_date=end_date,
        preset=preset
    )
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    summary = await ProjectService.get_marketing_summary(project_id, campaign_name=campaign_name, start_date=start_date, end_date=end_date, preset=preset)
    if summary is None:
        summary = {
            "project_name": "Digital Marketing Project",
            "timeline": {"start_date": None, "end_date": None},
            "filters": {
                "campaign_name": campaign_name or "All Campaigns",
                "preset": preset,
                "start_date": str(start_date) if start_date else None,
                "end_date": str(end_date) if end_date else None
            },
            "kpis": {
                "reach": {"value": 0.0, "formatted": "0", "growth_pct": 0.0},
                "leads": {"value": 0.0, "formatted": "0", "growth_pct": 0.0},
                "cost_per_lead": {"value": 0.0, "formatted": "₹0.00", "growth_pct": 0.0},
                "amount_spent": {"value": 0.0, "formatted": "₹0.00", "growth_pct": 0.0},
                "impressions": {"value": 0.0, "formatted": "0", "growth_pct": 0.0},
                "revenue": {"value": 0.0, "formatted": "₹0.00", "growth_pct": 0.0}
            },
            "top_campaigns": []
        }
    await set_cache(cache_key, summary, ttl=60)
    return summary

@router.put("/{project_id}/marketing-stats/{stat_id}", response_model=DailyMarketingStat)
async def update_daily_marketing_stat(project_id: str, stat_id: str, data: DailyMarketingStatUpdate, current_user: dict = Depends(get_current_employee)):
    stat = await ProjectService.update_daily_marketing_stat(project_id, stat_id, data)
    if not stat:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update stat or stat not found")
    await clear_pattern(f"projects:{project_id}:*")
    return stat

@router.delete("/{project_id}/marketing-stats/{stat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_daily_marketing_stat(project_id: str, stat_id: str, current_user: dict = Depends(get_current_employee)):
    success = await ProjectService.delete_daily_marketing_stat(project_id, stat_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete stat or stat not found")
    await clear_pattern(f"projects:{project_id}:*")

@router.get("/{project_id}/marketing-campaigns", response_model=List[str])
async def get_marketing_campaigns(project_id: str, current_user: dict = Depends(get_current_employee)):
    cache_key = f"projects:{project_id}:campaigns"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    campaigns = await ProjectService.get_marketing_campaigns(project_id)
    result = campaigns if campaigns is not None else []
    await set_cache(cache_key, result, ttl=60)
    return result

@router.post("/{project_id}/marketing-campaigns", response_model=List[str], status_code=status.HTTP_201_CREATED)
async def add_marketing_campaign(project_id: str, data: MarketingCampaignCreate, current_user: dict = Depends(get_current_employee)):
    campaigns = await ProjectService.add_marketing_campaign(project_id, data.name)
    if campaigns is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to add campaign or project not found")
    await clear_pattern(f"projects:{project_id}:*")
    return campaigns

@router.delete("/{project_id}/marketing-campaigns/{campaign_name}", response_model=List[str])
async def delete_marketing_campaign(project_id: str, campaign_name: str, current_user: dict = Depends(get_current_employee)):
    campaigns = await ProjectService.delete_marketing_campaign(project_id, campaign_name)
    if campaigns is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete campaign or project not found")
    await clear_pattern(f"projects:{project_id}:*")
    return campaigns

@router.post("/{project_id}/daily-revenue", response_model=DailyRevenue, status_code=status.HTTP_201_CREATED)
async def add_daily_revenue(project_id: str, data: DailyRevenueCreate, current_user: dict = Depends(get_current_employee)):
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    revenue = await ProjectService.add_daily_revenue(project_id, data, emp_id)
    if not revenue:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to add daily revenue or project not found")
    await clear_pattern(f"projects:{project_id}:*")
    return revenue

@router.get("/{project_id}/daily-revenue", response_model=List[DailyRevenue])
async def get_daily_revenues(
    project_id: str,
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    preset: Optional[str] = Query(None, description="Preset filter: today, yesterday, last_7_days, last_14_days, last_28_days, last_30_days, this_week, last_week, this_month, last_month, maximum"),
    current_user: dict = Depends(get_current_employee)
):
    cache_key = make_list_key(
        f"projects:{project_id}:daily_revenues",
        start_date=start_date,
        end_date=end_date,
        preset=preset
    )
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    revenues = await ProjectService.get_daily_revenues(project_id, start_date=start_date, end_date=end_date, preset=preset)
    result = revenues if revenues is not None else []
    await set_cache(cache_key, result, ttl=60)
    return result

@router.put("/{project_id}/daily-revenue/{revenue_id}", response_model=DailyRevenue)
async def update_daily_revenue(project_id: str, revenue_id: str, data: DailyRevenueUpdate, current_user: dict = Depends(get_current_employee)):
    revenue = await ProjectService.update_daily_revenue(project_id, revenue_id, data)
    if not revenue:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update daily revenue or revenue not found")
    await clear_pattern(f"projects:{project_id}:*")
    return revenue

@router.delete("/{project_id}/daily-revenue/{revenue_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_daily_revenue(project_id: str, revenue_id: str, current_user: dict = Depends(get_current_employee)):
    success = await ProjectService.delete_daily_revenue(project_id, revenue_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete daily revenue or revenue not found")
    await clear_pattern(f"projects:{project_id}:*")

@router.get("/{project_id}/marketing-workspace", response_model=MarketingWorkspaceResponse)
async def get_marketing_workspace(
    project_id: str,
    campaign_name: Optional[str] = Query(None, description="Filter by campaign name"),
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    preset: Optional[str] = Query(None, description="Preset filter: today, yesterday, last_7_days, last_14_days, last_28_days, last_30_days, this_week, last_week, this_month, last_month, maximum"),
    current_user: dict = Depends(get_current_employee)
):
    cache_key = make_list_key(
        f"projects:{project_id}:marketing_workspace",
        campaign_name=campaign_name,
        start_date=start_date,
        end_date=end_date,
        preset=preset
    )
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    workspace = await ProjectService.get_marketing_workspace(
        project_id, 
        campaign_name=campaign_name, 
        start_date=start_date, 
        end_date=end_date, 
        preset=preset
    )
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    await set_cache(cache_key, workspace, ttl=60)
    return workspace

@router.get("/{project_id}/task-summary", response_model=ProjectTaskSummaryResponse)
async def get_project_task_summary(
    project_id: str,
    current_user: dict = Depends(get_current_employee)
):
    cache_key = f"projects:{project_id}:task_summary"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    from app.services.task import TaskService
    summary = await TaskService.get_project_task_summary(project_id)
    if summary is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    await set_cache(cache_key, summary, ttl=60)
    return summary

@router.get("/{project_id}/activity-logs")
async def get_project_activity_logs(
    project_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1),
    current_user: dict = Depends(get_current_employee)
):
    from app.services.task import TaskService
    return await TaskService.get_project_activity_logs(project_id, page, limit)

@router.get("/{project_id}/tasks")
async def get_project_tasks(
    project_id: str,
    status: Optional[str] = Query(None, description="Filter by task status"),
    assigned_to: Optional[str] = Query(None, description="Filter by assigned employee ID"),
    timeline_filter: Optional[str] = Query(None, description="Filter by timeline: today, pending, upcoming"),
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    search: Optional[str] = Query(None, description="Search by task title"),
    view: Optional[str] = Query("me", description="View scope: 'me' (My Tasks) or 'team' (Team Tasks)"),
    page: Optional[int] = Query(None, ge=1),
    limit: Optional[int] = Query(None, ge=1),
    current_user: dict = Depends(get_current_employee)
):
    role = current_user.get("work_details", {}).get("system_role", "Employee")
    designation = current_user.get("work_details", {}).get("designation", "")
    department = current_user.get("work_details", {}).get("department", "")
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    
    involved_emp_id = None
    team_employee_ids = None
    is_operational = "operation" in str(department or "").strip().lower()
    
    if role not in ["Admin", "Subadmin", "HR"] and not is_operational:
        is_leader = str(designation).lower() in ["team leader", "head"]
        if is_leader and view == "team":
            from app.repository.employee import EmployeeRepository
            dept_emps = await EmployeeRepository.get_all_employees(department=department, limit=1000)
            team_employee_ids = [str(e["_id"]) for e in dept_emps.get("data", [])]
        else:
            involved_emp_id = emp_id

    cache_key = make_list_key(
        f"projects:{project_id}:tasks",
        status=status,
        assigned_to=assigned_to,
        timeline_filter=timeline_filter,
        start_date=start_date,
        end_date=end_date,
        search=search,
        view=view,
        user_id=emp_id,
        role=role,
        page=page,
        limit=limit
    )
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    from app.services.task import TaskService
    result = await TaskService.get_all_tasks(
        is_deleted=False,
        project_id=project_id,
        status=status,
        assigned_to=assigned_to,
        timeline_filter=timeline_filter,
        start_date=start_date,
        end_date=end_date,
        search=search,
        involved_emp_id=involved_emp_id,
        team_employee_ids=team_employee_ids,
        page=page,
        limit=limit
    )
    await set_cache(cache_key, result, ttl=60)
    return result

@router.post("/{project_id}/tasks", status_code=status.HTTP_201_CREATED)
async def create_project_task(project_id: str, data: TaskCreate, current_user: dict = Depends(get_current_employee)):
    from app.services.task import TaskService
    data.project_id = project_id
    assigned_by = str(current_user.get("_id") or current_user.get("id"))
    role = current_user.get("work_details", {}).get("system_role", "Employee")
    designation = str(current_user.get("work_details", {}).get("designation", "")).lower()
    
    if not data.assigned_to:
        data.assigned_to = assigned_by
        
    user_dept = str(current_user.get("work_details", {}).get("department", "") or "").strip().lower()
    is_operational = "operation" in user_dept
    if role not in ["Admin", "Subadmin", "HR"] and designation not in ["team leader", "head"] and not is_operational:
        if data.assigned_to != assigned_by:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are only allowed to assign tasks to yourself.")
            
    created = await TaskService.create_task(data, assigned_by)
    await clear_pattern(f"projects:{project_id}:*")
    await clear_pattern("tasks:*")
    return await TaskService.get_task_by_id(created["_id"])

@router.put("/{project_id}/tasks/{task_id}")
async def update_project_task(project_id: str, task_id: str, data: TaskUpdate, current_user: dict = Depends(get_current_employee)):
    from app.services.task import TaskService
    
    item = await TaskService.get_task_by_id(task_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    role = current_user.get("work_details", {}).get("system_role", "Employee")
    designation = str(current_user.get("work_details", {}).get("designation", "")).lower()
    
    user_dept = str(current_user.get("work_details", {}).get("department", "") or "").strip().lower()
    is_operational = "operation" in user_dept
    if role not in ["Admin", "Subadmin", "HR"] and not is_operational:
        if item.get("assigned_to") != emp_id and item.get("assigned_by") != emp_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this task")
            
        if data.assigned_to and data.assigned_to != item.get("assigned_to"):
            if designation not in ["team leader", "head"] and data.assigned_to != emp_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are only allowed to assign tasks to yourself.")
                
    updated = await TaskService.update_task(task_id, data, emp_id)
    if not updated:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update task")

    await clear_pattern(f"projects:{project_id}:*")
    await clear_pattern("tasks:*")
    return await TaskService.get_task_by_id(task_id)

@router.delete("/{project_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project_task(project_id: str, task_id: str, current_user: dict = Depends(get_current_employee)):
    from app.services.task import TaskService
    success = await TaskService.delete_task(task_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete task")

    await clear_pattern(f"projects:{project_id}:*")
    await clear_pattern("tasks:*")





# ==============================================================================
# PROJECT DOCS / KNOWLEDGE BASE (Audio Transcript [00:07-01:09]: "i" button)
# ==============================================================================
from bson import ObjectId
from app.database.db import get_database
import uuid
from datetime import datetime

DEFAULT_PROJECT_DOCS = []

@router.get("/{project_id}/docs")
async def get_project_docs(project_id: str, current_user: dict = Depends(get_current_employee)):
    db = get_database()
    query = {"_id": ObjectId(project_id)} if ObjectId.is_valid(project_id) else {"_id": project_id}
    project = await db["projects"].find_one(query, {"docs": 1, "name": 1})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    docs = project.get("docs")
    if not docs or not isinstance(docs, list):
        docs = []
    return {"status": "success", "data": docs}

@router.put("/{project_id}/docs")
async def update_project_docs(project_id: str, body: dict, current_user: dict = Depends(get_current_employee)):
    db = get_database()
    query = {"_id": ObjectId(project_id)} if ObjectId.is_valid(project_id) else {"_id": project_id}
    pages = body.get("pages", [])
    emp_name = current_user.get("name") or current_user.get("personal_info", {}).get("first_name", "Team Member")
    now_iso = datetime.utcnow().isoformat()
    for p in pages:
        if not p.get("id"):
            p["id"] = f"page_{uuid.uuid4().hex[:8]}"
        p["updated_at"] = now_iso
        p["updated_by"] = emp_name
    await db["projects"].update_one(query, {"$set": {"docs": pages, "updated_at": datetime.utcnow()}})
    await clear_pattern(f"projects:{project_id}:*")
    return {"status": "success", "data": pages}


# ==============================================================================
# MARKETING WORKFLOW STEPS (Audio Transcript [01:09-02:36]: "Set Steps by Assignee Person")
# ==============================================================================

DEFAULT_MARKETING_STEPS = []

@router.get("/{project_id}/marketing-steps")
async def get_marketing_steps(project_id: str, current_user: dict = Depends(get_current_employee)):
    db = get_database()
    query = {"_id": ObjectId(project_id)} if ObjectId.is_valid(project_id) else {"_id": project_id}
    project = await db["projects"].find_one(query, {"marketing_steps": 1})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    steps = project.get("marketing_steps")
    if not steps or not isinstance(steps, list):
        steps = []
    return {"status": "success", "data": steps}

@router.put("/{project_id}/marketing-steps")
async def update_marketing_steps(project_id: str, body: dict, current_user: dict = Depends(get_current_employee)):
    db = get_database()
    query = {"_id": ObjectId(project_id)} if ObjectId.is_valid(project_id) else {"_id": project_id}
    steps = body.get("steps", [])
    await db["projects"].update_one(query, {"$set": {"marketing_steps": steps, "updated_at": datetime.utcnow()}})
    await clear_pattern(f"projects:{project_id}:*")
    return {"status": "success", "data": steps}


# ==============================================================================
# MARKETING MILESTONES / GOALS & BUDGET (Audio Transcript [02:36-03:48]: "Set Goal & Budget Type Wise & Aslo Enter Month Wise")
# ==============================================================================

@router.get("/{project_id}/marketing-goals")
async def get_marketing_goals(project_id: str, current_user: dict = Depends(get_current_employee)):
    db = get_database()
    query = {"_id": ObjectId(project_id)} if ObjectId.is_valid(project_id) else {"_id": project_id}
    project = await db["projects"].find_one(query, {"marketing_goals": 1, "daily_marketing_stats": 1})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    goals = project.get("marketing_goals", []) or []
    stats = project.get("daily_marketing_stats", []) or []

    for g in goals:
        g_cat = str(g.get("category", "ALL")).upper()
        g_sub = str(g.get("sub_type", "")).strip()
        g_month = str(g.get("month", "")).strip()
        g_start = str(g.get("start_date", "")).strip()
        g_end = str(g.get("end_date", "")).strip()

        matched_stats = []
        for s in stats:
            s_date = str(s.get("date", ""))[:10]
            s_cat = str(s.get("category", "")).upper()
            s_sub = str(s.get("sub_type", "")).strip()

            if g_cat not in ("ALL", "BLENDED") and s_cat != g_cat:
                continue
            if g_sub and s_sub and g_sub != s_sub:
                continue

            if g_month and not s_date.startswith(g_month):
                continue
            if g_start and s_date < g_start:
                continue
            if g_end and s_date > g_end:
                continue

            matched_stats.append(s)

        act_spend = sum(float(s.get("spend") or 0) for s in matched_stats)
        act_revenue = sum(float(s.get("revenue") or 0) for s in matched_stats)
        act_leads = sum(int(s.get("results") or 0) for s in matched_stats)
        act_roas = round(act_revenue / act_spend, 2) if act_spend > 0 else 0.0

        g["actual_spend"] = act_spend
        g["actual_revenue"] = act_revenue
        g["actual_leads"] = act_leads
        g["actual_roas"] = act_roas

        tgt_spend = float(g.get("target_spend") or 0)
        tgt_revenue = float(g.get("target_revenue") or 0)
        tgt_leads = int(g.get("target_leads") or 0)

        g["spend_pct"] = round((act_spend / tgt_spend) * 100, 1) if tgt_spend > 0 else 0
        g["revenue_pct"] = round((act_revenue / tgt_revenue) * 100, 1) if tgt_revenue > 0 else 0
        g["leads_pct"] = round((act_leads / tgt_leads) * 100, 1) if tgt_leads > 0 else 0

        if tgt_revenue > 0:
            if act_revenue >= tgt_revenue:
                g["status"] = "achieved"
            elif g["revenue_pct"] >= 70:
                g["status"] = "on_track"
            else:
                g["status"] = "in_progress"
        elif tgt_leads > 0:
            if act_leads >= tgt_leads:
                g["status"] = "achieved"
            elif g["leads_pct"] >= 70:
                g["status"] = "on_track"
            else:
                g["status"] = "in_progress"
        else:
            g["status"] = "in_progress"

    return {"status": "success", "data": goals}

@router.post("/{project_id}/marketing-goals", status_code=201)
async def create_marketing_goal(project_id: str, body: dict, current_user: dict = Depends(get_current_employee)):
    db = get_database()
    query = {"_id": ObjectId(project_id)} if ObjectId.is_valid(project_id) else {"_id": project_id}
    goal_id = f"goal_{uuid.uuid4().hex[:10]}"
    emp_name = current_user.get("name") or current_user.get("personal_info", {}).get("first_name", "Admin")
    goal = {
        "id": goal_id,
        "title": str(body.get("title") or "Monthly Performance Goal").strip(),
        "category": str(body.get("category") or "ALL").upper().strip(),
        "sub_type": str(body.get("sub_type") or "").strip(),
        "month": str(body.get("month") or datetime.utcnow().strftime("%Y-%m")).strip(),
        "start_date": str(body.get("start_date") or "").strip(),
        "end_date": str(body.get("end_date") or "").strip(),
        "target_spend": float(body.get("target_spend") or 0),
        "target_revenue": float(body.get("target_revenue") or 0),
        "target_leads": int(body.get("target_leads") or 0),
        "target_roas": float(body.get("target_roas") or 0),
        "notes": str(body.get("notes") or "").strip(),
        "created_at": datetime.utcnow().isoformat(),
        "created_by": emp_name
    }
    await db["projects"].update_one(query, {"$push": {"marketing_goals": goal}, "$set": {"updated_at": datetime.utcnow()}})
    await clear_pattern(f"projects:{project_id}:*")
    return {"status": "success", "data": goal}

@router.put("/{project_id}/marketing-goals/{goal_id}")
async def update_marketing_goal(project_id: str, goal_id: str, body: dict, current_user: dict = Depends(get_current_employee)):
    db = get_database()
    query = {"_id": ObjectId(project_id)} if ObjectId.is_valid(project_id) else {"_id": project_id}
    project = await db["projects"].find_one(query, {"marketing_goals": 1})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    goals = project.get("marketing_goals", []) or []
    updated = False
    for g in goals:
        if g.get("id") == goal_id:
            for k in ["title", "category", "sub_type", "month", "start_date", "end_date", "target_spend", "target_revenue", "target_leads", "target_roas", "notes"]:
                if k in body:
                    g[k] = body[k]
            updated = True
            break
    if not updated:
        raise HTTPException(status_code=404, detail="Goal not found")
    await db["projects"].update_one(query, {"$set": {"marketing_goals": goals, "updated_at": datetime.utcnow()}})
    await clear_pattern(f"projects:{project_id}:*")
    return {"status": "success", "data": goals}

@router.delete("/{project_id}/marketing-goals/{goal_id}")
async def delete_marketing_goal(project_id: str, goal_id: str, current_user: dict = Depends(get_current_employee)):
    db = get_database()
    query = {"_id": ObjectId(project_id)} if ObjectId.is_valid(project_id) else {"_id": project_id}
    await db["projects"].update_one(query, {"$pull": {"marketing_goals": {"id": goal_id}}, "$set": {"updated_at": datetime.utcnow()}})
    await clear_pattern(f"projects:{project_id}:*")
    return {"status": "success", "message": "Goal deleted successfully"}
