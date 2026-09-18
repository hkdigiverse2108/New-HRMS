from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator
from typing import Optional, Dict, Any
from datetime import datetime, date
from enum import Enum

class ProjectCategory(str, Enum):
    DEVELOPMENT = "Development"
    CREATIVE = "Creative"
    DIGITAL_MARKETING = "Digital Marketing"
    SALES = "Sales"

class ProjectStatus(str, Enum):
    NOT_STARTED = "Not Started"
    IN_PROGRESS = "In Progress"
    ON_HOLD = "On Hold"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"

class ProjectPriority(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    URGENT = "Urgent"

class CalendarApprovalStatus(str, Enum):
    PENDING = "Pending"
    APPROVED_BY_CLIENT = "Approved by Client"
    CHANGES_REQUESTED = "Changes Requested"
    REJECTED = "Rejected"

class FollowUpScheduleType(str, Enum):
    FIXED_INTERVAL = "Fixed Interval (Days)"
    WEEKLY = "Weekly (Specific Days)"
    MONTHLY = "Monthly (Specific Dates)"

class ContentCalendarApproval(BaseModel):
    month: int = Field(..., ge=1, le=12)
    year: int
    status: CalendarApprovalStatus = Field(default=CalendarApprovalStatus.PENDING)
    reason: Optional[str] = None
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None

class ContentCalendarApprovalUpdate(BaseModel):
    month: int = Field(..., ge=1, le=12)
    year: int
    status: CalendarApprovalStatus
    reason: Optional[str] = None
    
    @model_validator(mode='after')
    def check_reason(self):
        if self.status != CalendarApprovalStatus.APPROVED_BY_CLIENT and not self.reason:
            raise ValueError("Reason is required when status is not 'Approved by Client'")
        return self

class FollowUpLogCreate(BaseModel):
    text: str = Field(..., description="Notes/details for the follow-up")

class FollowUpLog(BaseModel):
    id: str
    text: str
    created_at: datetime
    created_by: str
    created_by_details: Optional[dict] = None
    
    model_config = ConfigDict(populate_by_name=True)

class ClientReviewCreate(BaseModel):
    review_text: str = Field(..., description="The main text of the client review")

class ClientReviewUpdate(BaseModel):
    admin_comment: str = Field(..., description="Admin/Manager comment on the review")

class ClientReview(BaseModel):
    id: str
    review_text: str
    admin_comment: Optional[str] = None
    created_at: datetime
    created_by: str
    created_by_details: Optional[dict] = None

class DigitalMarketingStats(BaseModel):
    reach_target: Optional[str] = None
    leads_target: Optional[int] = None
    cpl: Optional[float] = None

class CreativeStats(BaseModel):
    standard_posts: bool = False
    post_count_per_month: int = 0
    reels_videos: bool = False
    reel_count_per_month: int = 0
    festival_posts_included: bool = False
    graphics_banners_required: bool = False

class ProjectGeneralDetails(BaseModel):
    project_name: str = Field(..., description="Name of the project")
    description: Optional[str] = None
    category: ProjectCategory = Field(..., description="Category of the project")
    status: ProjectStatus = Field(default=ProjectStatus.NOT_STARTED, description="Current status of the project")
    priority: ProjectPriority = Field(default=ProjectPriority.MEDIUM)
    progress: int = Field(default=0, ge=0, le=100, description="Project completion percentage")
    start_date: date = Field(..., description="Project start date")
    end_date: date = Field(..., description="Project end date")
    team_deadline: Optional[date] = None
    digital_marketing_stats: Optional[DigitalMarketingStats] = None
    creative_stats: Optional[CreativeStats] = None

    @field_validator('category', mode='before')
    def parse_category(cls, v):
        if isinstance(v, str):
            clean_v = v.lower().replace(" ", "").replace("_", "")
            cat_map = {"development": "Development", "creative": "Creative", "digitalmarketing": "Digital Marketing", "sales": "Sales"}
            return cat_map.get(clean_v, v)
        return v

    @field_validator('status', mode='before')
    def parse_status(cls, v):
        if isinstance(v, str):
            clean_v = v.lower().replace(" ", "").replace("_", "")
            stat_map = {"notstarted": "Not Started", "inprogress": "In Progress", "onhold": "On Hold", "completed": "Completed", "cancelled": "Cancelled"}
            return stat_map.get(clean_v, v)
        return v
        
    @field_validator('priority', mode='before')
    def parse_priority(cls, v):
        if isinstance(v, str):
            clean_v = v.lower().replace(" ", "").replace("_", "")
            pri_map = {"low": "Low", "medium": "Medium", "high": "High", "urgent": "Urgent"}
            return pri_map.get(clean_v, v)
        return v

class ProjectFinanceDetails(BaseModel):
    project_budget: Optional[float] = None
    amount_received: Optional[float] = None
    next_payment_date: Optional[date] = None

class CampaignStatus(str, Enum):
    ACTIVE = "Active"
    INACTIVE = "Inactive"

class CreativeTeam(BaseModel):
    scripting: Optional[str] = None
    reel_editing: Optional[str] = None
    post_graphics: Optional[str] = None
    shoot_videography: Optional[str] = None
    approval_qc: Optional[str] = None
    posting_publisher: Optional[str] = None
    caption: Optional[str] = None
    thumbnail: Optional[str] = None

class Campaign(BaseModel):
    name: str
    status: CampaignStatus = Field(default=CampaignStatus.ACTIVE)

class ProjectBase(BaseModel):
    client_id: str = Field(..., description="Client ID this project belongs to")
    general: ProjectGeneralDetails
    finance: Optional[ProjectFinanceDetails] = None
    campaigns: Optional[list[Campaign]] = Field(default=None, description="Marketing campaigns")
    creative_team: Optional[CreativeTeam] = None
    whatsapp_group_link: Optional[str] = None
    greetings_msg_sent: bool = False
    has_content_calendar: bool = False
    followup_schedule_type: Optional[FollowUpScheduleType] = None
    followup_schedule_value: Optional[list[int]] = Field(default=None, description="E.g. [7] for 7 days, [0, 3] for Mon & Thu")
    last_followup_date: Optional[date] = None
    next_followup_date: Optional[date] = None
    feedback_schedule_type: Optional[FollowUpScheduleType] = None
    feedback_schedule_value: Optional[list[int]] = None
    last_feedback_date: Optional[date] = None
    next_feedback_date: Optional[date] = None
    followup_logs: Optional[list[FollowUpLog]] = []
    client_reviews: Optional[list[ClientReview]] = []
    content_approvals: Optional[list[ContentCalendarApproval]] = []

class ProjectCreate(ProjectBase):
    pass

class ProjectGeneralUpdate(BaseModel):
    project_name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[ProjectCategory] = None
    status: Optional[ProjectStatus] = None
    priority: Optional[ProjectPriority] = None
    progress: Optional[int] = Field(None, ge=0, le=100)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    team_deadline: Optional[date] = None
    digital_marketing_stats: Optional[DigitalMarketingStats] = None
    creative_stats: Optional[CreativeStats] = None

class ProjectFinanceUpdate(BaseModel):
    project_budget: Optional[float] = None
    amount_received: Optional[float] = None
    next_payment_date: Optional[date] = None

class ProjectUpdate(BaseModel):
    client_id: Optional[str] = None
    general: Optional[ProjectGeneralUpdate] = None
    finance: Optional[ProjectFinanceUpdate] = None
    campaigns: Optional[list[Campaign]] = None
    creative_team: Optional[CreativeTeam] = None
    whatsapp_group_link: Optional[str] = None
    greetings_msg_sent: Optional[bool] = None
    has_content_calendar: Optional[bool] = None
    followup_schedule_type: Optional[FollowUpScheduleType] = None
    followup_schedule_value: Optional[list[int]] = None
    last_followup_date: Optional[date] = None
    feedback_schedule_type: Optional[FollowUpScheduleType] = None
    feedback_schedule_value: Optional[list[int]] = None
    last_feedback_date: Optional[date] = None
    followup_logs: Optional[list[FollowUpLog]] = None
    client_reviews: Optional[list[ClientReview]] = None

class ProjectResponse(ProjectBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime
    is_deleted: bool = False
    
    client: Optional[dict] = None
    creative_team_details: Optional[dict] = None
    
    model_config = ConfigDict(populate_by_name=True)
