from fastapi import APIRouter, Depends, Query, status, HTTPException
from typing import Optional, List, Dict, Any

from app.schemas.leave import (
    LeaveCreateRequest,
    LeaveUpdateRequest,
    LeaveStatusUpdateRequest,
    LeaveOut
)
from app.services.leave import LeaveService
from app.controllers.auth import get_current_employee, RoleChecker
from app.redis.service import get_cache, set_cache, delete_cache, clear_pattern, make_list_key

router = APIRouter(prefix="/leaves", tags=["Leaves"])

@router.post("", response_model=LeaveOut, status_code=status.HTTP_201_CREATED)
async def apply_leave(
    payload: LeaveCreateRequest,
    current_employee: dict = Depends(get_current_employee)
):
    """
    Apply for leave (Full Day, Half Day, First Half, Second Half).
    Status defaults to 'Pending'. Auto-notifies HR/Admin.
    """
    work = current_employee.get("work_details", {})
    user_role = work.get("system_role", "Employee")
    dept = work.get("department", "")
    if dept.lower() == "hr" or current_employee.get("role") == "HR":
        user_role = "HR"

    # Only Admin (strict admin / superadmin) can apply on behalf of other employees.
    # Non-admin roles (including HR, Managers, Employees) must strictly apply for themselves.
    is_strict_admin = str(user_role).strip().lower() in ("admin", "superadmin")
    if payload.employee_id and is_strict_admin:
        target_employee_id = payload.employee_id
    else:
        target_employee_id = str(current_employee.get("_id") or current_employee.get("id") or current_employee.get("email") or "")

    doc = await LeaveService.apply_leave(employee_id=target_employee_id, leave_data=payload.model_dump())
    
    try:
        from app.repository.notification import NotificationRepository
        from app.database.db import get_database
        db = get_database()
        personal = current_employee.get("personal_info", {})
        emp_name = f"{personal.get('first_name', '')} {personal.get('last_name', '')}".strip() or current_employee.get("name") or "An employee"
        hr_admins = await db["employees"].find({
            "$or": [
                {"work_details.system_role": {"$in": ["Admin", "HR", "superadmin", "Sub-Admin"]}},
                {"role": {"$in": ["Admin", "HR", "superadmin"]}}
            ]
        }).to_list(length=20)
        curr_id = str(current_employee.get("_id") or current_employee.get("id") or "")
        for hr_admin in hr_admins:
            recipient_id = str(hr_admin.get("_id") or hr_admin.get("id") or "")
            if recipient_id and recipient_id != curr_id:
                await NotificationRepository.create_notification({
                    "recipient_id": recipient_id,
                    "title": f"Leave Request: {emp_name}",
                    "message": f"{emp_name} requested {payload.type} ({payload.start_date} to {payload.end_date}).",
                    "type": "leave",
                    "action_url": "/employees/leave-requests",
                    "sender_id": curr_id,
                    "is_read": False
                })
    except Exception as e:
        print(f"Error creating leave notification: {e}")

    # Invalidate leave and attendance caches
    await clear_pattern("leaves:list:*")
    await clear_pattern("attendance:*")
    if "_id" in doc:
        await set_cache(f"leave:{doc['_id']}", doc, ttl=300)
        
    return doc

@router.get("", response_model=List[LeaveOut])
async def get_leaves(
    employee_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    page: Optional[int] = Query(None, ge=1),
    limit: Optional[int] = Query(None, ge=1),
    current_employee: dict = Depends(get_current_employee)
):
    """
    List leave requests with Redis caching.
    - Admin & HR: View all requests or filter.
    - Regular Employee: Restricted to their own requests only.
    """
    work = current_employee.get("work_details", {})
    user_role = work.get("system_role", "Employee")
    dept = work.get("department", "")
    if dept.lower() == "hr" or current_employee.get("role") == "HR":
        user_role = "HR"
    current_id = str(current_employee.get("_id") or current_employee.get("id") or current_employee.get("email") or "")

    cache_key = make_list_key(
        "leaves",
        emp=employee_id,
        stat=status,
        tp=type,
        start=start_date,
        end=end_date,
        page=page,
        limit=limit,
        role=user_role,
        uid=current_id
    )
    
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    result = await LeaveService.get_leaves(
        employee_id=employee_id,
        status=status,
        leave_type=type,
        start_date=start_date,
        end_date=end_date,
        page=page,
        limit=limit,
        current_user_role=user_role,
        current_user_id=current_id
    )
    
    await set_cache(cache_key, result, ttl=180)
    return result

@router.put("/{leave_id}", response_model=LeaveOut)
async def update_leave(
    leave_id: str,
    payload: LeaveUpdateRequest,
    current_employee: dict = Depends(get_current_employee)
):
    """
    Update an existing leave request.
    Restricted to the employee who created the leave.
    Only allows updates if the leave is still in 'Pending' status.
    """
    employee_id = str(current_employee.get("_id") or current_employee.get("id") or current_employee.get("email") or "")
    
    updated_doc = await LeaveService.update_leave_details(
        leave_id=leave_id,
        employee_id=employee_id,
        update_data=payload.model_dump(exclude_unset=True)
    )
    return updated_doc

@router.patch("/{leave_id}/status", response_model=LeaveOut)
async def update_leave_status(
    leave_id: str,
    payload: LeaveStatusUpdateRequest,
    current_employee: dict = Depends(get_current_employee)
):
    """
    Approve or Reject leave request.
    Restricted to HR and Admin roles.
    CRITICAL: Approving a leave automatically updates/creates attendance records for those dates!
    """
    work = current_employee.get("work_details", {})
    user_role = work.get("system_role", "Employee")
    dept = work.get("department", "")
    if dept.lower() == "hr" or current_employee.get("role") == "HR":
        user_role = "HR"

    if user_role not in ("Admin", "HR", "Sub-Admin", "superadmin") and dept.lower() != "hr":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR or Admin can approve or reject leave requests."
        )

    # Transcript requirement: HR cannot approve or reject their own leave requests
    is_strict_admin = user_role in ("Admin", "superadmin", "Sub-Admin")
    if not is_strict_admin:
        from app.repository.leave import LeaveRepository
        existing_leave = await LeaveRepository.get_by_id(leave_id)
        if not existing_leave:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found.")

        target_emp_id = str(existing_leave.get("employee_id") or "")
        curr_ids = [
            str(current_employee.get("_id", "")),
            str(current_employee.get("id", "")),
            str(current_employee.get("email", "")),
            str(current_employee.get("personal_info", {}).get("email_address", "")),
            str(current_employee.get("work_details", {}).get("employee_id", ""))
        ]
        if target_emp_id and target_emp_id in curr_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="HR cannot approve or reject their own leave request. An Admin must approve it."
            )

    personal = current_employee.get("personal_info", {})
    decider_name = f"{personal.get('first_name', '')} {personal.get('last_name', '')}".strip() or user_role

    updated_doc = await LeaveService.update_leave_status(
        leave_id=leave_id,
        new_status=payload.status,
        rejection_reason=payload.rejection_reason,
        decided_by=decider_name
    )

    try:
        from app.repository.notification import NotificationRepository
        target_emp_id = updated_doc.get("employee_id") if isinstance(updated_doc, dict) else None
        if target_emp_id:
            reason_note = f" Reason: {payload.rejection_reason}" if payload.rejection_reason else ""
            decider_id = str(current_employee.get("_id") or current_employee.get("id") or "")
            await NotificationRepository.create_notification({
                "recipient_id": str(target_emp_id),
                "title": f"Leave Request {payload.status}",
                "message": f"Your leave request has been {payload.status.lower()} by {decider_name}.{reason_note}",
                "type": "leave",
                "action_url": "/employees/leave-requests",
                "sender_id": decider_id,
                "is_read": False
            })
    except Exception as e:
        print(f"Error creating leave update notification: {e}")

    # Invalidate Redis caches
    await delete_cache(f"leave:{leave_id}")
    await clear_pattern("leaves:list:*")
    await clear_pattern("attendance:*")
    
    return updated_doc

@router.get("/{leave_id}", response_model=LeaveOut)
async def get_leave_by_id(
    leave_id: str,
    current_employee: dict = Depends(get_current_employee)
):
    cache_key = f"leave:{leave_id}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return cached

    from app.repository.leave import LeaveRepository
    doc = await LeaveRepository.get_by_id(leave_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found.")
        
    await set_cache(cache_key, doc, ttl=300)
    return doc

@router.delete("/{leave_id}", status_code=status.HTTP_200_OK)
async def delete_leave(
    leave_id: str,
    current_employee: dict = Depends(get_current_employee)
):
    """
    Delete a leave request.
    - Admin can delete any.
    - Employee can only delete their own 'Pending' leave.
    """
    employee_id = str(current_employee.get("_id") or current_employee.get("id") or current_employee.get("email") or "")
    work = current_employee.get("work_details", {})
    user_role = work.get("system_role", "Employee")
    
    deleted = await LeaveService.delete_leave(
        leave_id=leave_id,
        current_user_id=employee_id,
        current_user_role=user_role
    )
    
    if not deleted:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete leave request.")
        
    return {"message": "Leave request deleted successfully."}
