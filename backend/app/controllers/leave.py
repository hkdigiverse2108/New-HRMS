from fastapi import APIRouter, Depends, Query, status, HTTPException
from typing import Optional, List, Dict, Any

from app.schemas.leave import (
    LeaveCreateRequest,
    LeaveStatusUpdateRequest,
    LeaveOut
)
from app.services.leave import LeaveService
from app.controllers.auth import get_current_employee, RoleChecker

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
    employee_id = str(current_employee.get("_id") or current_employee.get("id") or current_employee.get("email") or "")
    doc = await LeaveService.apply_leave(employee_id=employee_id, leave_data=payload.model_dump())
    return doc

@router.get("", response_model=List[LeaveOut])
async def get_leaves(
    employee_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_employee: dict = Depends(get_current_employee)
):
    """
    List leave requests.
    - Admin & HR: View all requests or filter.
    - Regular Employee: Restricted to their own requests only.
    """
    work = current_employee.get("work_details", {})
    user_role = work.get("system_role", "Employee")
    current_id = str(current_employee.get("_id") or current_employee.get("id") or current_employee.get("email") or "")

    return await LeaveService.get_leaves(
        employee_id=employee_id,
        status=status,
        leave_type=type,
        start_date=start_date,
        end_date=end_date,
        current_user_role=user_role,
        current_user_id=current_id
    )

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

    if user_role not in ("Admin", "HR", "Sub-Admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR or Admin can approve or reject leave requests."
        )

    personal = current_employee.get("personal_info", {})
    decider_name = f"{personal.get('first_name', '')} {personal.get('last_name', '')}".strip() or user_role

    return await LeaveService.update_leave_status(
        leave_id=leave_id,
        new_status=payload.status,
        rejection_reason=payload.rejection_reason,
        decided_by=decider_name
    )

@router.get("/{leave_id}", response_model=LeaveOut)
async def get_leave_by_id(
    leave_id: str,
    current_employee: dict = Depends(get_current_employee)
):
    from app.repository.leave import LeaveRepository
    doc = await LeaveRepository.get_by_id(leave_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found.")
    return doc
