from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
from app.schemas.invoice import (
    InvoiceCreate,
    InvoiceUpdate,
    InvoiceResponse,
    InvoiceStatusUpdate,
    InvoiceAccessUpdate,
    InvoiceRejectRequest,
    BrandLedgerResponse
)
from app.schemas.pagination import PaginatedResponse
from app.services.invoice import InvoiceService
from app.controllers.auth import get_current_employee

router = APIRouter(prefix="/invoices", tags=["Invoices"])

def check_admin_role(user: dict):
    work = user.get("work_details", {})
    role = str(work.get("system_role") or user.get("system_role", "Employee")).strip()
    if role.lower() not in ["admin", "subadmin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Admin can perform invoice approvals or access management")
    return role

@router.get("/next-number")
async def get_next_invoice_number(
    invoice_type: str = Query("Tax Invoice", description="'Tax Invoice' or 'Proforma Invoice'"),
    current_user: dict = Depends(get_current_employee)
):
    next_num = await InvoiceService.get_next_number(invoice_type)
    return {"invoice_type": invoice_type, "next_invoice_number": next_num}

@router.get("/ledger/brands", response_model=BrandLedgerResponse, response_model_exclude_none=True)
async def get_brand_invoice_ledger(
    invoice_type: Optional[str] = Query(None, description="Filter by 'Tax Invoice' or 'Proforma Invoice' or 'All'"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    from_date: Optional[str] = Query(None, description="From date (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="To date (YYYY-MM-DD)"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Filter by month (1 to 12)"),
    year: Optional[int] = Query(None, ge=2000, le=2100, description="Filter by year (e.g. 2026)"),
    search: Optional[str] = Query(None, description="Search term for Brand Name"),
    page: Optional[int] = Query(None, ge=1),
    limit: Optional[int] = Query(None, ge=1),
    current_user: dict = Depends(get_current_employee)
):
    return await InvoiceService.get_brand_ledger(
        invoice_type=invoice_type,
        start_date=start_date,
        end_date=end_date,
        from_date=from_date,
        to_date=to_date,
        month=month,
        year=year,
        search=search,
        current_user=current_user,
        page=page,
        limit=limit
    )

@router.get("/approvals/pending", response_model=PaginatedResponse[InvoiceResponse], response_model_exclude_none=True)
async def get_pending_invoice_approvals(
    page: Optional[int] = Query(None, ge=1),
    limit: Optional[int] = Query(None, ge=1),
    current_user: dict = Depends(get_current_employee)
):
    check_admin_role(current_user)
    return await InvoiceService.get_all_invoices(
        is_deleted=False,
        status="pending_approval",
        current_user=current_user,
        page=page,
        limit=limit
    )

@router.post("/{invoice_id}/approve", response_model=InvoiceResponse, response_model_exclude_none=True)
async def approve_invoice(
    invoice_id: str,
    current_user: dict = Depends(get_current_employee)
):
    check_admin_role(current_user)
    item = await InvoiceService.get_invoice_by_id(invoice_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    success = await InvoiceService.approve_invoice(invoice_id, current_user)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to approve invoice")

    return await InvoiceService.get_invoice_by_id(invoice_id)

@router.post("/{invoice_id}/reject", response_model=InvoiceResponse, response_model_exclude_none=True)
async def reject_invoice(
    invoice_id: str,
    body: Optional[InvoiceRejectRequest] = None,
    current_user: dict = Depends(get_current_employee)
):
    check_admin_role(current_user)
    item = await InvoiceService.get_invoice_by_id(invoice_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    reason = body.reason if body else "Rejected by Admin"
    success = await InvoiceService.reject_invoice(invoice_id, current_user, reason)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to reject invoice")

    return await InvoiceService.get_invoice_by_id(invoice_id)

@router.put("/{invoice_id}/access", response_model=InvoiceResponse, response_model_exclude_none=True)
async def update_invoice_access(
    invoice_id: str,
    data: InvoiceAccessUpdate,
    current_user: dict = Depends(get_current_employee)
):
    item = await InvoiceService.get_invoice_by_id(invoice_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    # Check permission: Admin or Creator can grant access
    is_admin = InvoiceService.is_admin_user(current_user)
    creator_id = str(item.get("created_by", {}).get("user_id", "")).strip()
    uid = str(current_user.get("_id", "")).strip()

    if not is_admin and creator_id != uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Admin or Creator can manage access for this invoice")

    success = await InvoiceService.update_invoice_access(invoice_id, data.employee_ids, current_user)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update invoice access")

    return await InvoiceService.get_invoice_by_id(invoice_id)

@router.post("", response_model=InvoiceResponse, response_model_exclude_none=True, status_code=status.HTTP_201_CREATED)
async def create_invoice(data: InvoiceCreate, current_user: dict = Depends(get_current_employee)):
    created = await InvoiceService.create_invoice(data, current_user)
    return await InvoiceService.get_invoice_by_id(created["_id"])

@router.get("", response_model=PaginatedResponse[InvoiceResponse], response_model_exclude_none=True)
async def get_all_invoices(
    invoice_type: Optional[str] = Query(None, description="Filter by 'Tax Invoice' or 'Proforma Invoice'"),
    status: Optional[str] = Query(None, description="Filter by status: paid, pending_approval, unpaid, partially_paid, cancelled, rejected"),
    search: Optional[str] = Query(None, description="Search term for invoice_number, client_name, etc."),
    client_id: Optional[str] = Query(None, description="Filter by client ID"),
    page: Optional[int] = Query(None, ge=1, description="Page number"),
    limit: Optional[int] = Query(None, ge=1, description="Items per page"),
    current_user: dict = Depends(get_current_employee)
):
    return await InvoiceService.get_all_invoices(
        is_deleted=False,
        invoice_type=invoice_type,
        status=status,
        search=search,
        client_id=client_id,
        current_user=current_user,
        page=page,
        limit=limit
    )

@router.get("/{invoice_id}", response_model=InvoiceResponse, response_model_exclude_none=True)
async def get_invoice_by_id(invoice_id: str, current_user: dict = Depends(get_current_employee)):
    item = await InvoiceService.get_invoice_by_id(invoice_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    if not InvoiceService.check_user_access(item, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view this invoice")

    return item

@router.put("/{invoice_id}", response_model=InvoiceResponse, response_model_exclude_none=True)
async def update_invoice(
    invoice_id: str,
    data: InvoiceUpdate,
    current_user: dict = Depends(get_current_employee)
):
    item = await InvoiceService.get_invoice_by_id(invoice_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    if not InvoiceService.check_user_access(item, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to modify this invoice")

    updated = await InvoiceService.update_invoice(invoice_id, data, current_user)
    if not updated:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update invoice")

    return await InvoiceService.get_invoice_by_id(invoice_id)

@router.patch("/{invoice_id}/status", response_model=InvoiceResponse, response_model_exclude_none=True)
async def update_invoice_status(
    invoice_id: str,
    data: InvoiceStatusUpdate,
    current_user: dict = Depends(get_current_employee)
):
    item = await InvoiceService.get_invoice_by_id(invoice_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    if not InvoiceService.check_user_access(item, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to update status of this invoice")

    success = await InvoiceService.update_status(invoice_id, data.status, current_user)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update invoice status")

    return await InvoiceService.get_invoice_by_id(invoice_id)

@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invoice(invoice_id: str, current_user: dict = Depends(get_current_employee)):
    item = await InvoiceService.get_invoice_by_id(invoice_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    if not InvoiceService.check_user_access(item, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to delete this invoice")

    success = await InvoiceService.delete_invoice(invoice_id, current_user)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete invoice")
