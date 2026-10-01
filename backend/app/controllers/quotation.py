from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
from app.schemas.quotation import (
    QuotationCreate,
    QuotationUpdate,
    QuotationResponse,
    QuotationStatusUpdate,
    ConvertToInvoiceRequest,
    QuotationKPIResponse
)
from app.schemas.invoice import InvoiceResponse
from app.schemas.pagination import PaginatedResponse
from app.services.quotation import QuotationService
from app.services.invoice import InvoiceService
from app.controllers.auth import get_current_employee

router = APIRouter(prefix="/quotations", tags=["Quotations"])

@router.get("/next-number")
async def get_next_quotation_number(current_user: dict = Depends(get_current_employee)):
    next_num = await QuotationService.get_next_number()
    return {"next_quotation_number": next_num}

@router.get("/stats/kpi", response_model=QuotationKPIResponse)
async def get_quotation_kpi_stats(
    timeline: Optional[str] = Query("all", description="today, this_week, this_month, this_quarter, this_year, all"),
    from_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    to_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    client_id: Optional[str] = Query(None, description="Filter by client ID"),
    current_user: dict = Depends(get_current_employee)
):
    return await QuotationService.get_kpi_stats(
        timeline=timeline,
        from_date=from_date,
        to_date=to_date,
        client_id=client_id
    )

@router.post("", response_model=QuotationResponse, response_model_exclude_none=True, status_code=status.HTTP_201_CREATED)
async def create_quotation(data: QuotationCreate, current_user: dict = Depends(get_current_employee)):
    created = await QuotationService.create_quotation(data, current_user)
    return await QuotationService.get_quotation_by_id(created["_id"])

@router.get("", response_model=PaginatedResponse[QuotationResponse], response_model_exclude_none=True)
async def get_all_quotations(
    status: Optional[str] = Query(None, description="Filter by status: overdue, upcoming, cancelled, draft, sent, accepted, declined, expired, converted, all"),
    timeline: Optional[str] = Query(None, description="Filter timeline: today, this_week, this_month, this_quarter, this_year, all"),
    from_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    to_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    search: Optional[str] = Query(None, description="Search by quotation_number, client_name, etc."),
    client_id: Optional[str] = Query(None, description="Filter by client ID"),
    page: Optional[int] = Query(None, ge=1, description="Page number"),
    limit: Optional[int] = Query(None, ge=1, description="Items per page"),
    current_user: dict = Depends(get_current_employee)
):
    return await QuotationService.get_all_quotations(
        is_deleted=False,
        status=status,
        search=search,
        client_id=client_id,
        timeline=timeline,
        from_date=from_date,
        to_date=to_date,
        page=page,
        limit=limit
    )

from fastapi.responses import FileResponse
import os

@router.get("/{quotation_id}/pdf")
async def download_quotation_pdf(quotation_id: str, current_user: dict = Depends(get_current_employee)):
    item = await QuotationService.get_quotation_by_id(quotation_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quotation not found")

    updated_item = await QuotationService._generate_and_store_quotation_pdf(quotation_id, delete_old=True)
    if updated_item:
        pdf_path = updated_item.get("pdf_path")
    else:
        pdf_path = item.get("pdf_path")

    if not pdf_path or not os.path.exists(os.path.abspath(pdf_path)):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to locate or generate PDF file")

    abs_path = os.path.abspath(pdf_path)
    quo_num = item.get("quotation_number", "quotation")
    return FileResponse(
        path=abs_path,
        media_type="application/pdf",
        filename=f"{quo_num}.pdf",
        content_disposition_type="inline"
    )

@router.get("/{quotation_id}", response_model=QuotationResponse, response_model_exclude_none=True)
async def get_quotation_by_id(quotation_id: str, current_user: dict = Depends(get_current_employee)):
    item = await QuotationService.get_quotation_by_id(quotation_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quotation not found")
    return item

@router.put("/{quotation_id}", response_model=QuotationResponse, response_model_exclude_none=True)
async def update_quotation(
    quotation_id: str,
    data: QuotationUpdate,
    current_user: dict = Depends(get_current_employee)
):
    item = await QuotationService.get_quotation_by_id(quotation_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quotation not found")

    updated = await QuotationService.update_quotation(quotation_id, data)
    if not updated:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update quotation")

    return await QuotationService.get_quotation_by_id(quotation_id)

from fastapi.responses import FileResponse
import os

@router.get("/{quotation_id}/pdf")
@router.get("/{quotation_id}/download")
async def download_quotation_pdf(quotation_id: str, current_user: dict = Depends(get_current_employee)):
    item = await QuotationService.get_quotation_by_id(quotation_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quotation not found")

    # Always regenerate with latest settings, logo, signature & template design
    updated_item = await QuotationService._generate_and_store_quotation_pdf(quotation_id, delete_old=True)
    if updated_item:
        pdf_path = updated_item.get("pdf_path")
    else:
        pdf_path = item.get("pdf_path")

    if not pdf_path or not os.path.exists(os.path.abspath(pdf_path)):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to locate or generate PDF file")

    abs_path = os.path.abspath(pdf_path)
    quo_num = item.get("quotation_number", "quotation")
    return FileResponse(
        path=abs_path,
        media_type="application/pdf",
        filename=f"{quo_num}.pdf",
        content_disposition_type="inline"
    )

@router.patch("/{quotation_id}/status", response_model=QuotationResponse, response_model_exclude_none=True)
async def update_quotation_status(
    quotation_id: str,
    data: QuotationStatusUpdate,
    current_user: dict = Depends(get_current_employee)
):
    item = await QuotationService.get_quotation_by_id(quotation_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quotation not found")

    success = await QuotationService.update_status(quotation_id, data.status)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update quotation status")

    return await QuotationService.get_quotation_by_id(quotation_id)

@router.post("/{quotation_id}/convert-to-invoice", response_model=InvoiceResponse, response_model_exclude_none=True)
async def convert_quotation_to_invoice(
    quotation_id: str,
    body: Optional[ConvertToInvoiceRequest] = None,
    current_user: dict = Depends(get_current_employee)
):
    item = await QuotationService.get_quotation_by_id(quotation_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quotation not found")

    converted_invoice = await QuotationService.convert_to_invoice(
        quotation_id=quotation_id,
        convert_req=body,
        current_user=current_user
    )
    if not converted_invoice:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to convert quotation to invoice")

    return converted_invoice

@router.delete("/{quotation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quotation(quotation_id: str, current_user: dict = Depends(get_current_employee)):
    item = await QuotationService.get_quotation_by_id(quotation_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quotation not found")

    success = await QuotationService.delete_quotation(quotation_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete quotation")
