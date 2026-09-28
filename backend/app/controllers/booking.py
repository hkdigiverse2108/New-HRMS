from fastapi import APIRouter, Depends, Query, status, HTTPException, Request
from typing import Optional, List, Dict, Any
from datetime import date, datetime

from app.schemas.booking import (
    BookingPageCreate,
    BookingPageUpdate,
    BookingPageResponse,
    PublicEmployeeProfileResponse,
    GuestBookingRequest,
    AppointmentBookingResponse
)
from app.repository.booking import BookingRepository
from app.controllers.auth import get_current_employee

# Authenticated router for logged-in employees
booking_router = APIRouter(prefix="/schedule", tags=["Booking Page Management"])

# Public router for guest users (No Auth Token required)
public_booking_router = APIRouter(prefix="/booking/public", tags=["Public Guest Booking"])

# ===============================================
# Employee Authenticated Booking Page Routes
# ===============================================

@booking_router.post("/booking-pages", response_model=BookingPageResponse, status_code=status.HTTP_201_CREATED)
async def create_booking_page(
    payload: BookingPageCreate,
    request: Request,
    current_employee: dict = Depends(get_current_employee)
):
    """
    Create a new booking page configuration for the logged-in employee.
    Generates a shareable booking link dynamically based on environment or request host.
    """
    user_id = str(current_employee.get("work_details", {}).get("employee_id") or current_employee.get("_id") or current_employee.get("id"))
    data = payload.model_dump()
    data["request_base_url"] = str(request.base_url)
    created = await BookingRepository.create_booking_page(employee_id=user_id, data=data)
    return created

@booking_router.get("/booking-pages", response_model=List[BookingPageResponse])
async def get_my_booking_pages(
    current_employee: dict = Depends(get_current_employee)
):
    """
    Get all booking page configurations & shareable links for the logged-in employee.
    """
    user_id = str(current_employee.get("work_details", {}).get("employee_id") or current_employee.get("_id") or current_employee.get("id"))
    pages = await BookingRepository.get_employee_booking_pages(employee_id=user_id)
    return pages

@booking_router.get("/booking-pages/{page_id}", response_model=BookingPageResponse)
async def get_booking_page_by_id(
    page_id: str,
    current_employee: dict = Depends(get_current_employee)
):
    """
    Get specific booking page details by ID (strictly isolated to the logged-in user).
    """
    user_id = str(current_employee.get("work_details", {}).get("employee_id") or current_employee.get("_id") or current_employee.get("id"))
    page = await BookingRepository.get_booking_page_by_id(page_id, employee_id=user_id)
    if not page:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking page not found or access denied.")
    return page

@booking_router.put("/booking-pages/{page_id}", response_model=Dict[str, str])
async def update_booking_page(
    page_id: str,
    payload: BookingPageUpdate,
    current_employee: dict = Depends(get_current_employee)
):
    """
    Update booking page configuration (working hours, slot duration, active status).
    """
    user_id = str(current_employee.get("work_details", {}).get("employee_id") or current_employee.get("_id") or current_employee.get("id"))
    update_data = payload.model_dump(exclude_unset=True)

    success = await BookingRepository.update_booking_page(page_id=page_id, employee_id=user_id, update_data=update_data)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update booking page.")
    return {"message": "Booking page updated successfully."}

@booking_router.delete("/booking-pages/{page_id}", response_model=Dict[str, str])
async def delete_booking_page(
    page_id: str,
    current_employee: dict = Depends(get_current_employee)
):
    """
    Delete a booking page configuration.
    """
    user_id = str(current_employee.get("work_details", {}).get("employee_id") or current_employee.get("_id") or current_employee.get("id"))
    success = await BookingRepository.delete_booking_page(page_id=page_id, employee_id=user_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete booking page.")
    return {"message": "Booking page deleted successfully."}

@booking_router.get("/bookings", response_model=List[AppointmentBookingResponse])
async def get_my_appointments(
    current_employee: dict = Depends(get_current_employee)
):
    """
    Get all confirmed appointments booked by guests with the logged-in employee.
    """
    user_id = str(current_employee.get("work_details", {}).get("employee_id") or current_employee.get("_id") or current_employee.get("id"))
    bookings = await BookingRepository.get_employee_bookings(employee_id=user_id)
    return bookings

# ===============================================
# Public Guest Booking Routes (No Auth Required)
# ===============================================

@public_booking_router.get("/{employee_id}", response_model=PublicEmployeeProfileResponse)
async def get_public_employee_booking_profile(
    employee_id: str
):
    """
    Public API: Fetch Employee profile info & active booking pages by employee_id.
    Returns 404 if booking page is unavailable or has been deleted.
    """
    profile = await BookingRepository.get_public_employee_profile(employee_id=employee_id)
    if not profile or not profile.get("booking_pages"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking page is unavailable or has been deleted.")
    return profile

@public_booking_router.get("/{employee_id}/available-slots", response_model=Dict[str, Any])
async def get_public_available_time_slots(
    employee_id: str,
    date_ref: Optional[date] = Query(None, alias="date", description="Target date for booking"),
    page_id: Optional[str] = Query(None, description="Optional booking page ID")
):
    """
    Public API: Dynamically calculate open time slots for employee_id on a target date.
    Excludes existing HRMS meetings, Google Calendar events, and approved leaves.
    """
    target_d = date_ref or date.today()
    slots_info = await BookingRepository.calculate_public_available_slots(
        employee_id=employee_id,
        target_date=target_d,
        page_id=page_id
    )
    if slots_info.get("is_valid_page") is False:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking page is unavailable or has been deleted.")
    return slots_info

@public_booking_router.post("/{employee_id}/book", response_model=AppointmentBookingResponse, status_code=status.HTTP_201_CREATED)
async def submit_guest_appointment_booking(
    employee_id: str,
    payload: GuestBookingRequest
):
    """
    Public API: Submit an appointment booking with employee_id.
    - Creates HRMS Schedule Meeting event.
    - Syncs to Host Google Calendar.
    - Generates Google Meet Video Call Link automatically.
    - Sends Confirmation Email to Host and Guest.
    """
    data = payload.model_dump()
    booking = await BookingRepository.create_guest_appointment_booking(employee_id=employee_id, booking_data=data)
    if isinstance(booking, dict) and booking.get("error"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=booking.get("error"))
    return booking

@public_booking_router.post("/cancel/{booking_id}", response_model=Dict[str, str])
async def cancel_appointment_booking(
    booking_id: str
):
    """
    Public/Auth API: Cancel an appointment booking by ID.
    """
    success = await BookingRepository.cancel_booking(booking_id=booking_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to cancel appointment booking.")
    return {"message": "Appointment booking cancelled successfully."}
