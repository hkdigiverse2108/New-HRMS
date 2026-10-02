from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, List
from app.schemas.letter_request import (
    LetterRequestCreate, LetterRequestUpdate,
    SendDocumentRequest, RejectRequestInput, LetterRequestResponse
)
from app.services.letter_request import LetterRequestService
from app.controllers.auth import get_current_employee

router = APIRouter(prefix="/letter-requests", tags=["Letter Requests Workflow"])

def is_admin_or_hr(user: dict) -> bool:
    work = user.get("work_details", {})
    role = str(work.get("system_role") or user.get("system_role", "Employee")).strip().lower()
    return role in ["admin", "subadmin", "hr", "hr manager"]

@router.post("", response_model=LetterRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_letter_request(
    data: LetterRequestCreate,
    current_user: dict = Depends(get_current_employee)
):
    # If not admin/hr, enforce requesting only for oneself
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    if not is_admin_or_hr(current_user):
        data.employee_id = emp_id

    created = await LetterRequestService.create_request(data, current_user)
    if not created:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to create letter request")
    return created

@router.get("", response_model=List[LetterRequestResponse])
async def get_all_letter_requests(
    employee_id: Optional[str] = Query(None, description="Filter by employee ID"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (Pending, Sent, Approved, Rejected)"),
    search: Optional[str] = Query(None, description="Search employee name, letter type, or reason"),
    current_user: dict = Depends(get_current_employee)
):
    emp_id = str(current_user.get("_id") or current_user.get("id"))
    
    # If standard Employee, force filter by their own employee_id
    if not is_admin_or_hr(current_user):
        employee_id = emp_id

    return await LetterRequestService.get_all_requests(
        is_deleted=False,
        employee_id=employee_id,
        status=status_filter,
        search=search
    )

@router.get("/{item_id}", response_model=LetterRequestResponse)
async def get_letter_request_by_id(
    item_id: str,
    current_user: dict = Depends(get_current_employee)
):
    req = await LetterRequestService.get_by_id(item_id)
    if not req or req.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Letter request not found")

    emp_id = str(current_user.get("_id") or current_user.get("id"))
    if not is_admin_or_hr(current_user) and req.get("employee_id") != emp_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return req

@router.put("/{item_id}", response_model=LetterRequestResponse)
async def update_letter_request(
    item_id: str,
    data: LetterRequestUpdate,
    current_user: dict = Depends(get_current_employee)
):
    req = await LetterRequestService.get_by_id(item_id)
    if not req or req.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Letter request not found")

    emp_id = str(current_user.get("_id") or current_user.get("id"))
    if not is_admin_or_hr(current_user) and req.get("employee_id") != emp_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    updated = await LetterRequestService.update_request(item_id, data)
    if not updated:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update letter request")
    return updated

@router.post("/{item_id}/send-document", response_model=LetterRequestResponse)
async def send_document_for_request(
    item_id: str,
    send_data: SendDocumentRequest,
    current_user: dict = Depends(get_current_employee)
):
    if not is_admin_or_hr(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Admin or HR can send documents for requests")

    updated = await LetterRequestService.send_document(item_id, send_data, current_user)
    if not updated:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to send document for request")
    return updated

@router.post("/{item_id}/approve", response_model=LetterRequestResponse)
async def approve_letter_request(
    item_id: str,
    current_user: dict = Depends(get_current_employee)
):
    req = await LetterRequestService.get_by_id(item_id)
    if not req or req.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Letter request not found")

    emp_id = str(current_user.get("_id") or current_user.get("id"))
    if not is_admin_or_hr(current_user) and req.get("employee_id") != emp_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    updated = await LetterRequestService.approve_request(item_id, current_user)
    if not updated:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to approve letter request")
    return updated

@router.post("/{item_id}/reject", response_model=LetterRequestResponse)
async def reject_letter_request(
    item_id: str,
    input_data: Optional[RejectRequestInput] = None,
    current_user: dict = Depends(get_current_employee)
):
    req = await LetterRequestService.get_by_id(item_id)
    if not req or req.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Letter request not found")

    emp_id = str(current_user.get("_id") or current_user.get("id"))
    if not is_admin_or_hr(current_user) and req.get("employee_id") != emp_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    reason = input_data.reason if input_data else None
    updated = await LetterRequestService.reject_request(item_id, reason)
    if not updated:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to reject letter request")
    return updated

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_letter_request(
    item_id: str,
    current_user: dict = Depends(get_current_employee)
):
    req = await LetterRequestService.get_by_id(item_id)
    if not req or req.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Letter request not found")

    emp_id = str(current_user.get("_id") or current_user.get("id"))
    if not is_admin_or_hr(current_user) and req.get("employee_id") != emp_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    success = await LetterRequestService.delete_request(item_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete letter request")
