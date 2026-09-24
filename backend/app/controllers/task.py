from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
from pydantic import BaseModel
from app.schemas.task import TaskCreate, TaskUpdate, TaskResponse, TaskStatus, TaskPriority, TaskQuickAssign, TransferRequestPayload
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

@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(data: TaskCreate, current_user: dict = Depends(get_current_employee)):
    from app.repository.employee import EmployeeRepository
    emp = await EmployeeRepository.get_employee_by_id(data.assigned_to)
    if not emp:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assigned employee does not exist")
        
    current_uid = str(current_user.get("_id") or current_user.get("id"))
    assigned_by = current_uid
    created = await TaskService.create_task(data, assigned_by)
    return await TaskService.get_task_by_id(created["_id"])

@router.post("/quick-assign", response_model=list[TaskResponse], status_code=status.HTTP_201_CREATED)
async def quick_assign_tasks(data: list[TaskQuickAssign], current_user: dict = Depends(get_current_employee)):
    from app.repository.employee import EmployeeRepository
    for task in data:
        for assignee in task.assigned_to:
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
    current_user: dict = Depends(get_current_employee)
):
    role = current_user.get("work_details", {}).get("system_role", "Employee")
    
    involved_emp_id = None
    if role not in ["Admin", "Subadmin", "HR"]:
        emp_id = str(current_user.get("_id") or current_user.get("id"))
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
        history_assigned_by=history_assigned_by
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
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    
    if role not in ["Admin", "Subadmin", "HR"]:
        if item.get("assigned_to") != emp_id and item.get("assigned_by") != emp_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this task")
            
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
