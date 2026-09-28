from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import datetime

class TimeWindow(BaseModel):
    start_time: str = Field(..., description="Start time in HH:MM format, e.g. '09:00'")
    end_time: str = Field(..., description="End time in HH:MM format, e.g. '17:00'")

class DayAvailability(BaseModel):
    day: str = Field(..., description="Day name, e.g. 'Monday'")
    is_available: bool = Field(default=True, description="Whether day is available")
    windows: List[TimeWindow] = Field(default=[], description="Time windows for this day")

class BookingPageCreate(BaseModel):
    title: str = Field(default="30 Min Consultation", description="Title of the appointment service")
    duration_minutes: int = Field(default=30, description="Slot duration in minutes: 15, 30, 45, 60, 90, 120")
    recurrence: str = Field(default="Repeat weekly", description="Recurrence setting: 'Repeat weekly', 'Does not repeat', 'Custom'")
    general_availability: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Per-day time windows e.g. {'Monday': {'is_available': True, 'windows': [{'start_time': '09:00', 'end_time': '12:00'}, {'start_time': '13:00', 'end_time': '17:00'}]}}"
    )
    copy_from_day: Optional[str] = Field(None, description="Optional: Day name to copy time slots from (e.g. 'Monday') to all working days")
    co_host_employee_ids: List[str] = Field(default=[], description="List of co-host employee IDs who should attend")
    working_days: List[str] = Field(
        default=["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        description="Available days of the week"
    )
    start_time: str = Field(default="09:00", description="Daily start time (e.g. '09:00')")
    end_time: str = Field(default="17:00", description="Daily end time (e.g. '17:00')")
    is_active: bool = Field(default=True, description="Whether booking page is active")

class BookingPageUpdate(BaseModel):
    title: Optional[str] = None
    duration_minutes: Optional[int] = None
    recurrence: Optional[str] = None
    general_availability: Optional[Dict[str, Any]] = None
    copy_from_day: Optional[str] = None
    co_host_employee_ids: Optional[List[str]] = None
    working_days: Optional[List[str]] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    is_active: Optional[bool] = None

class BookingPageResponse(BaseModel):
    id: str = Field(alias="_id")
    employee_id: str
    employee_details: Optional[Dict[str, Any]] = None
    title: str
    shareable_url: str
    duration_minutes: int = 30
    recurrence: str = "Repeat weekly"
    general_availability: Optional[Dict[str, Any]] = None
    co_host_employee_ids: List[str] = []
    co_hosts: Optional[List[Dict[str, Any]]] = []
    working_days: List[str] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    start_time: str = "09:00"
    end_time: str = "17:00"
    is_active: bool = True
    created_at: Optional[datetime.datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {
            datetime.date: lambda v: v.isoformat(),
            datetime.datetime: lambda v: v.isoformat()
        }

class PublicEmployeeProfileResponse(BaseModel):
    employee_id: str
    name: str
    email: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    profile_image: Optional[str] = None
    booking_pages: List[BookingPageResponse]

class GuestBookingRequest(BaseModel):
    booking_page_id: Optional[str] = Field(None, description="Optional specific booking page ID")
    first_name: Optional[str] = Field(None, description="First name of the guest")
    last_name: Optional[str] = Field(None, description="Last name/surname of the guest")
    surname: Optional[str] = Field(None, description="Surname of the guest (alias for last_name)")
    guest_name: Optional[str] = Field(None, description="Full name of the guest (optional if first_name & last_name provided)")
    guest_email: EmailStr = Field(..., description="Email address of the guest")
    guest_notes: Optional[str] = Field(None, description="Optional notes/topic for the meeting")
    date: datetime.date = Field(..., description="Target date for appointment")
    start_time: str = Field(..., description="Start time (e.g. '10:00')")
    end_time: str = Field(..., description="End time (e.g. '10:30')")

class AppointmentBookingResponse(BaseModel):
    id: str = Field(alias="_id")
    booking_page_id: Optional[str] = None
    booking_page_details: Optional[Dict[str, Any]] = None
    host_employee_id: str
    host_name: Optional[str] = None
    host_details: Optional[Dict[str, Any]] = None
    guest_name: str
    guest_email: str
    guest_notes: Optional[str] = None
    date: datetime.date
    start_time: str
    end_time: str
    status: str = "CONFIRMED"
    google_meet_link: Optional[str] = None
    hrms_event_id: Optional[str] = None
    created_at: Optional[datetime.datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {
            datetime.date: lambda v: v.isoformat(),
            datetime.datetime: lambda v: v.isoformat()
        }
