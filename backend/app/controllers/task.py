from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
from datetime import date
from pydantic import BaseModel
from app.schemas.task import (
    TaskCreate, TaskUpdate, TaskResponse, TaskStatus, TaskPriority, TaskQuickAssign,
    TransferRequestPayload, DailyPlannerCreate, DailyPlannerUpdate, DailyPlannerResponse,
    WorkLogsDashboardResponse
)
from app.schemas.pagination import PaginatedResponse
from app.services.task import TaskService
from app.controllers.auth import get_current_employee

class RejectReviewPayload(BaseModel):
    reason: Optional[str] = "Needs rework"

router = APIRouter(prefix="/tasks", tags=["Tasks"])

@router.get("/statuses", response_model=list[str])
async def get_task_statuses():
    return [s.value for s in TaskStatus]

@router.get("/priorities", response_model=list[str])
async def get_task_priorities():
    return [p.value for p in TaskPriority]

@router.get("/work-logs", response_model=WorkLogsDashboardResponse)
async def get_work_logs(
    date: Optional[str] = Query(None, description="Filter by date (YYYY-MM-DD, today, yesterday, this_week, this_month)"),
    start_date: Optional[str] = Query(None, description="Start date for range filter (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date for range filter (YYYY-MM-DD)"),
    employee_id: Optional[str] = Query(None, description="Filter by specific employee ID"),
    department_id: Optional[str] = Query(None, description="Filter by department ID"),
    status: Optional[str] = Query(None, description="Filter by status (e.g., 'current_activity')"),
    current_user: dict = Depends(get_current_employee)
):
    from app.services.work_log import WorkLogService
    return await WorkLogService.get_work_logs_dashboard(
        date_str=date,
        start_date=start_date,
        end_date=end_date,
        filter_employee_id=employee_id,
        department_id=department_id,
        status=status,
        current_user=current_user
    )

@router.get("/daily-overview")
async def get_daily_overview(
    employee_id: Optional[str] = Query(None, description="Optional employee ID (Admins can use this to check others' tasks)"),
    current_user: dict = Depends(get_current_employee)
):
    emp_id = employee_id or str(current_user.get("_id") or current_user.get("id"))
    return await TaskService.get_daily_overview(emp_id)

@router.post("/daily-planner", response_model=DailyPlannerResponse)
async def create_daily_planner(data: DailyPlannerCreate, current_user: dict = Depends(get_current_employee)):
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    from app.services.daily_planner import DailyPlannerService
    return await DailyPlannerService.create_planner(emp_id, data)

@router.put("/daily-planner", response_model=DailyPlannerResponse)
async def update_daily_planner(data: DailyPlannerUpdate, current_user: dict = Depends(get_current_employee)):
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    from app.services.daily_planner import DailyPlannerService
    return await DailyPlannerService.update_planner(emp_id, data)

@router.get("/daily-planner", response_model=Optional[DailyPlannerResponse])
async def get_daily_planner(current_user: dict = Depends(get_current_employee)):
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    from app.services.daily_planner import DailyPlannerService
    return await DailyPlannerService.get_planner_for_today(emp_id)

@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(data: TaskCreate, current_user: dict = Depends(get_current_employee)):
    from app.repository.employee import EmployeeRepository
    from datetime import date
    assigned_by = str(current_user.get("_id") or current_user.get("id"))
    
    role = current_user.get("work_details", {}).get("system_role", "Employee")
    designation = str(current_user.get("work_details", {}).get("designation", "")).lower()
    
    if not data.assigned_to:
        data.assigned_to = assigned_by
        
    if role not in ["Admin", "Subadmin", "HR"] and designation not in ["team leader", "head"]:
        if data.assigned_to != assigned_by:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are only allowed to assign tasks to yourself.")
            
    if not data.due_date:
        data.due_date = date.today()
        
    emp = await EmployeeRepository.get_employee_by_id(data.assigned_to)
    if not emp:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assigned employee does not exist")
        
    created = await TaskService.create_task(data, assigned_by)
    return await TaskService.get_task_by_id(created["_id"])

@router.post("/quick-assign", response_model=list[TaskResponse], status_code=status.HTTP_201_CREATED)
async def quick_assign_tasks(data: list[TaskQuickAssign], current_user: dict = Depends(get_current_employee)):
    from app.repository.employee import EmployeeRepository
    assigned_by = str(current_user.get("_id") or current_user.get("id"))
    role = current_user.get("work_details", {}).get("system_role", "Employee")
    designation = str(current_user.get("work_details", {}).get("designation", "")).lower()
    
    for task in data:
        for assignee in task.assigned_to:
            if role not in ["Admin", "Subadmin", "HR"] and designation not in ["team leader", "head"]:
                if assignee != assigned_by:
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are only allowed to assign tasks to yourself.")
                    
            emp = await EmployeeRepository.get_employee_by_id(assignee)
            if not emp:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Assigned employee {assignee} does not exist")
                
    assigned_by = str(current_user.get("_id") or current_user.get("id"))
    created_items = await TaskService.quick_assign_tasks(data, assigned_by)
    return created_items

@router.get("", response_model=PaginatedResponse[TaskResponse])
async def get_all_tasks(
    page: Optional[int] = Query(None, ge=1, description="Page number"),
    limit: Optional[int] = Query(None, ge=1, description="Items per page"),
    assigned_to: Optional[str] = Query(None, description="Filter by assigned_to employee ID"),
    assigned_by: Optional[str] = Query(None, description="Filter by assigned_by employee ID"),
    status: Optional[str] = Query(None, description="Filter by task status"),
    priority: Optional[str] = Query(None, description="Filter by task priority"),
    history_assigned_to: Optional[str] = Query(None, description="Filter by employee ID in transfer history as receiver"),
    history_assigned_by: Optional[str] = Query(None, description="Filter by employee ID in transfer history as sender"),
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    task_category: Optional[str] = Query(None, description="Filter by task category (e.g. Development)"),
    timeline_filter: Optional[str] = Query(None, description="Filter by timeline: today, pending, upcoming"),
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    search: Optional[str] = Query(None, description="Search by task title"),
    view: Optional[str] = Query("me", description="View scope: 'me' (My Tasks) or 'team' (Team Tasks)"),
    current_user: dict = Depends(get_current_employee)
):
    role = current_user.get("work_details", {}).get("system_role", "Employee")
    designation = current_user.get("work_details", {}).get("designation", "")
    department = current_user.get("work_details", {}).get("department", "")
    
    involved_emp_id = None
    team_employee_ids = None
    
    if role not in ["Admin", "Subadmin", "HR"]:
        emp_id = str(current_user.get("_id") or current_user.get("id"))
        is_leader = str(designation).lower() in ["team leader", "head"]
        
        if is_leader and view == "team":
            from app.repository.employee import EmployeeRepository
            dept_emps = await EmployeeRepository.get_all_employees(department=department, limit=1000)
            team_employee_ids = [str(e["_id"]) for e in dept_emps.get("data", [])]
        else:
            involved_emp_id = emp_id

    return await TaskService.get_all_tasks(
        is_deleted=False, 
        assigned_to=assigned_to, 
        assigned_by=assigned_by, 
        status=status, 
        priority=priority, 
        page=page, 
        limit=limit,
        involved_emp_id=involved_emp_id,
        history_assigned_to=history_assigned_to,
        history_assigned_by=history_assigned_by,
        project_id=project_id,
        task_category=task_category,
        timeline_filter=timeline_filter,
        start_date=start_date,
        end_date=end_date,
        search=search,
        team_employee_ids=team_employee_ids
    )

@router.get("/deleted", response_model=PaginatedResponse[TaskResponse])
async def get_deleted_tasks(
    page: Optional[int] = Query(None, ge=1),
    limit: Optional[int] = Query(None, ge=1),
    current_user: dict = Depends(get_current_employee)
):
    role = current_user.get("work_details", {}).get("system_role", "Employee")
    if role not in ["Admin", "Subadmin", "HR"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Admin/HR can view deleted tasks")
        
    return await TaskService.get_all_tasks(is_deleted=True, page=page, limit=limit)

@router.get("/stats")
async def get_task_stats(current_user: dict = Depends(get_current_employee)):
    role = current_user.get("work_details", {}).get("system_role", "Employee")
    involved_emp_id = None
    if role not in ["Admin", "Subadmin", "HR"]:
        involved_emp_id = str(current_user.get("_id") or current_user.get("id"))
    return await TaskService.get_task_stats(involved_emp_id)

@router.get("/{task_id}", response_model=TaskResponse)
async def get_task_by_id(task_id: str, current_user: dict = Depends(get_current_employee)):
    item = await TaskService.get_task_by_id(task_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        
    role = current_user.get("work_details", {}).get("system_role", "Employee")
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    
    if role not in ["Admin", "Subadmin", "HR"]:
        if item.get("assigned_to") != emp_id and item.get("assigned_by") != emp_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this task")
            
    return item

@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, data: TaskUpdate, current_user: dict = Depends(get_current_employee)):
    item = await TaskService.get_task_by_id(task_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        
    # Anyone who is assigned to or assigned by the task can update it.
    role = current_user.get("work_details", {}).get("system_role", "Employee")
    designation = str(current_user.get("work_details", {}).get("designation", "")).lower()
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    
    if role not in ["Admin", "Subadmin", "HR"]:
        if item.get("assigned_to") != emp_id and item.get("assigned_by") != emp_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this task")
            
        if data.assigned_to and data.assigned_to != item.get("assigned_to"):
            if designation not in ["team leader", "head"] and data.assigned_to != emp_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are only allowed to assign tasks to yourself.")
            
    if data.assigned_to is not None:
        from app.repository.employee import EmployeeRepository
        emp = await EmployeeRepository.get_employee_by_id(data.assigned_to)
        if not emp:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assigned employee does not exist")
            
    updated = await TaskService.update_task(task_id, data)
    if not updated:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update task")
        
    return await TaskService.get_task_by_id(task_id)

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: str, current_user: dict = Depends(get_current_employee)):
    item = await TaskService.get_task_by_id(task_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        
    role = current_user.get("work_details", {}).get("system_role", "Employee")
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    
    if role not in ["Admin", "Subadmin", "HR"]:
        # Only the creator/assigner can delete, not the assignee.
        if item.get("assigned_by") != emp_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this task")
            
    success = await TaskService.delete_task(task_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete task")

@router.post("/{task_id}/transfer/request", response_model=TaskResponse)
async def request_task_transfer(task_id: str, data: TransferRequestPayload, current_user: dict = Depends(get_current_employee)):
    item = await TaskService.get_task_by_id(task_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        
    role = current_user.get("work_details", {}).get("system_role", "Employee")
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    
    if role not in ["Admin", "Subadmin", "HR"]:
        if item.get("assigned_to") != emp_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only assigned employee can transfer this task")
            
    if item.get("transfer_request") and item["transfer_request"].get("status") == "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A transfer request is already pending for this task")
        
    from app.repository.employee import EmployeeRepository
    emp_to = await EmployeeRepository.get_employee_by_id(data.requested_to)
    if not emp_to:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Requested employee does not exist")
        
    updated = await TaskService.request_transfer(task_id, data.requested_to, emp_id, data.reason)
    if not updated:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to request transfer")

    try:
        from app.repository.notification import NotificationRepository
        task_title = item.get("title", "Task")
        sender_name = current_user.get("personal_info", {}).get("first_name") or current_user.get("name") or "A team member"
        reason_text = f" Reason: {data.reason}" if data.reason else ""
        await NotificationRepository.create_notification({
            "recipient_id": str(data.requested_to),
            "title": "Task Transfer Request",
            "message": f"{sender_name} requested to transfer task '{task_title}' to you.{reason_text}",
            "type": "task",
            "action_url": "/tasks",
            "is_read": False
        })
    except Exception as e:
        print(f"Error creating task transfer request notification: {e}")
        
    return await TaskService.get_task_by_id(task_id)

@router.post("/{task_id}/transfer/accept", response_model=TaskResponse)
async def accept_task_transfer(task_id: str, current_user: dict = Depends(get_current_employee)):
    item = await TaskService.get_task_by_id(task_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        
    req = item.get("transfer_request")
    if not req or req.get("status") != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No pending transfer request found")
        
    role = current_user.get("work_details", {}).get("system_role", "Employee")
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    if role not in ["Admin", "Subadmin", "HR"] and req.get("requested_to") != emp_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the requested employee can accept this transfer")
        
    updated = await TaskService.accept_transfer(task_id, item)
    if not updated:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to accept transfer")

    try:
        from app.repository.notification import NotificationRepository
        task_title = item.get("title", "Task")
        accepter_name = current_user.get("personal_info", {}).get("first_name") or current_user.get("name") or "User"
        orig_requester = req.get("requested_by")
        if orig_requester:
            await NotificationRepository.create_notification({
                "recipient_id": str(orig_requester),
                "title": "Task Transfer Accepted",
                "message": f"{accepter_name} accepted the transfer of task '{task_title}'.",
                "type": "task",
                "action_url": "/tasks",
                "is_read": False
            })
    except Exception as e:
        print(f"Error creating task transfer accept notification: {e}")
        
    return await TaskService.get_task_by_id(task_id)

@router.post("/{task_id}/transfer/reject", response_model=TaskResponse)
async def reject_task_transfer(task_id: str, current_user: dict = Depends(get_current_employee)):
    item = await TaskService.get_task_by_id(task_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        
    req = item.get("transfer_request")
    if not req or req.get("status") != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No pending transfer request found")
        
    role = current_user.get("work_details", {}).get("system_role", "Employee")
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    
    if role not in ["Admin", "Subadmin", "HR"] and req.get("requested_to") != emp_id and req.get("requested_by") != emp_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to reject/cancel this transfer request")
        
    updated = await TaskService.reject_transfer(task_id, item)
    if not updated:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to reject transfer")

    try:
        from app.repository.notification import NotificationRepository
        task_title = item.get("title", "Task")
        rejecter_name = current_user.get("personal_info", {}).get("first_name") or current_user.get("name") or "User"
        orig_requester = req.get("requested_by")
        if orig_requester and orig_requester != emp_id:
            await NotificationRepository.create_notification({
                "recipient_id": str(orig_requester),
                "title": "Task Transfer Declined",
                "message": f"{rejecter_name} declined the transfer of task '{task_title}'.",
                "type": "task",
                "action_url": "/tasks",
                "is_read": False
            })
    except Exception as e:
        print(f"Error creating task transfer reject notification: {e}")
        
    return await TaskService.get_task_by_id(task_id)

@router.post("/{task_id}/approve", response_model=TaskResponse)
async def approve_task(task_id: str, current_user: dict = Depends(get_current_employee)):
    item = await TaskService.get_task_by_id(task_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        
    role = current_user.get("work_details", {}).get("system_role", "Employee")
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    
    # Assigner or Admin/HR can approve
    if role not in ["Admin", "Subadmin", "HR"] and item.get("assigned_by") != emp_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the task assigner or Admin/HR can approve this task")
        
    updated = await TaskService.approve_task(task_id, emp_id)
    if not updated:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to approve task")
    return await TaskService.get_task_by_id(task_id)

@router.post("/{task_id}/reject-review", response_model=TaskResponse)
async def reject_review_task(task_id: str, data: Optional[RejectReviewPayload] = None, current_user: dict = Depends(get_current_employee)):
    item = await TaskService.get_task_by_id(task_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        
    role = current_user.get("work_details", {}).get("system_role", "Employee")
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    
    if role not in ["Admin", "Subadmin", "HR"] and item.get("assigned_by") != emp_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the task assigner or Admin/HR can reject review")
        
    reason = data.reason if data else "Needs rework"
    updated = await TaskService.reject_review(task_id, reason)
    if not updated:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to reject review")
    return await TaskService.get_task_by_id(task_id)
