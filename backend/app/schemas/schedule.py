from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import datetime

class BulkAddFilter(BaseModel):
    department_id: Optional[str] = None
    department: Optional[str] = None
    designation_id: Optional[str] = None
    designation: Optional[str] = None
    role: Optional[str] = None

class ScheduleEventCreate(BaseModel):
    title: str = Field(..., description="Title of the schedule block or meeting")
    primary_employee_id: Optional[str] = Field(None, description="Host or primary employee ID")
    attendees: List[str] = Field(default_factory=list, description="List of colleague employee IDs")
    bulk_add_filter: Optional[BulkAddFilter] = Field(None, description="Optional bulk selection by team, designation, or role")
    date: datetime.date = Field(..., description="Date of the schedule event")
    type: str = Field(default="Meeting", description="Type: Meeting, Focused Work, Client Call, Task, etc.")
    start_time: str = Field(..., description="Start time (e.g. '10:00')")
    end_time: str = Field(..., description="End time (e.g. '11:00')")
    description: Optional[str] = Field(None, description="Optional additional details")
    category: Optional[str] = Field(default="my_schedule", description="Category: my_schedule, work_anniversary, birthday")
    color: Optional[str] = Field(default=None, description="Color code or badge type")

class ScheduleEventUpdate(BaseModel):
    title: Optional[str] = None
    primary_employee_id: Optional[str] = None
    attendees: Optional[List[str]] = None
    date: Optional[datetime.date] = None
    type: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    color: Optional[str] = None

class ScheduleEventResponse(BaseModel):
    id: str = Field(alias="_id")
    title: str
    primary_employee_id: Optional[str] = None
    primary_employee_name: Optional[str] = None
    attendees: List[str] = []
    attendee_names: List[str] = []
    date: datetime.date
    type: str = "Meeting"
    start_time: str
    end_time: str
    description: Optional[str] = None
    category: str = "my_schedule"
    color: Optional[str] = None
    created_by: Optional[str] = None
    created_at: Optional[datetime.datetime] = None
    is_auto_generated: bool = False

    class Config:
        populate_by_name = True
        json_encoders = {
            datetime.date: lambda v: v.isoformat(),
            datetime.datetime: lambda v: v.isoformat()
        }

class FreeSlot(BaseModel):
    start_time: str
    end_time: str
    label: str

class FreeSlotsRequest(BaseModel):
    employee_ids: List[str] = Field(..., description="List of primary host + colleague employee IDs")
    date: datetime.date = Field(..., description="Target date to check free slots")
    slot_duration_minutes: int = Field(default=30, description="Minimum slot duration in minutes")

class FreeSlotsResponse(BaseModel):
    date: datetime.date
    employee_ids: List[str]
    total_common_slots: int
    available_slots: List[FreeSlot]

class BulkOptionsResponse(BaseModel):
    departments: List[Dict[str, Any]]
    designations: List[Dict[str, Any]]
    roles: List[str]

class CalendarFeedResponse(BaseModel):
    view_mode: str
    start_date: datetime.date
    end_date: datetime.date
    date_range_label: str
    todays_meetings_count: int
    events: List[ScheduleEventResponse]
