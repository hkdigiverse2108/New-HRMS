from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import date, timedelta
import datetime
from enum import Enum

# --- Timeline Settings Schema ---
class ContentTimelineSettings(BaseModel):
    project_id: str = Field(..., description="The ID of the parent project")
    script_days_before: int = 0
    shoot_days_before: int = 12
    editing_graphics_days_before: int = 6
    approval_days_before: int = 5

# --- Content Item Schema ---

class ContentType(str, Enum):
    REEL = "Reel"
    POST = "Post"
    STORY = "Story"

class ContentStatus(str, Enum):
    IN_PROGRESS = "In Progress"
    IN_REVIEW = "In Review"
    APPROVED = "Approved"
    PUBLISHED = "Published"
    CANCELLED = "Cancelled"

class StageDetails(BaseModel):
    date: Optional[datetime.date] = None
    link: Optional[str] = None

class ContentItemBase(BaseModel):
    project_id: str = Field(..., description="The ID of the parent project")
    schedule_date: date
    content_type: ContentType
    topic_title: str
    topic_description: Optional[str] = None
    reference_link: Optional[str] = None
    brand_person: Optional[str] = None
    
    # Production Stages
    script: StageDetails = Field(default_factory=StageDetails)
    shoot: StageDetails = Field(default_factory=StageDetails)
    editing: StageDetails = Field(default_factory=StageDetails)
    thumbnail: StageDetails = Field(default_factory=StageDetails)
    
    caption_date: Optional[date] = None
    caption_text: Optional[str] = None
    
    instagram_link: Optional[str] = None
    issues: List[str] = []
    
    approval_status: ContentStatus = Field(default=ContentStatus.IN_PROGRESS)
    approved_by: Optional[str] = None # Employee ID
    
    actual_posting_date: Optional[date] = None

class ContentItemCreate(ContentItemBase):
    pass

class ContentItemUpdate(BaseModel):
    schedule_date: Optional[date] = None
    content_type: Optional[ContentType] = None
    topic_title: Optional[str] = None
    topic_description: Optional[str] = None
    reference_link: Optional[str] = None
    brand_person: Optional[str] = None
    script: Optional[StageDetails] = None
    shoot: Optional[StageDetails] = None
    editing: Optional[StageDetails] = None
    thumbnail: Optional[StageDetails] = None
    caption_date: Optional[date] = None
    caption_text: Optional[str] = None
    instagram_link: Optional[str] = None
    issues: Optional[List[str]] = None
    approval_status: Optional[ContentStatus] = None
    approved_by: Optional[str] = None
    actual_posting_date: Optional[date] = None

class DateRangeConfig(BaseModel):
    start_date: date
    end_date: date
    weekdays: List[int] = Field(..., description="0=Monday, 6=Sunday")

class BulkAddRequest(BaseModel):
    default_format: ContentType
    date_range: Optional[DateRangeConfig] = None
    specific_dates: Optional[List[date]] = None

class ContentItemResponse(ContentItemBase):
    id: str = Field(alias="_id")
    created_at: str
    updated_at: str
    is_deleted: bool = False
    
    # Populated fields
    approved_by_details: Optional[dict] = None
    brand_person_details: Optional[dict] = None

    model_config = ConfigDict(populate_by_name=True)

class ContentCalendarResponse(BaseModel):
    start_date: Optional[datetime.date] = None
    end_date: Optional[datetime.date] = None
    data: List[ContentItemResponse]
    total: int
    page: int
    limit: int
    total_pages: int
