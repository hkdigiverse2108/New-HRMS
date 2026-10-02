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
    IN_REVIEW = "In Review"
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

# K12: Client Reviews system removed (transcript — no requirement).

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
    category: str = Field(..., description="Category or comma-separated departments of the project")
    status: ProjectStatus = Field(default=ProjectStatus.NOT_STARTED, description="Current status of the project")
    priority: ProjectPriority = Field(default=ProjectPriority.MEDIUM)
    progress: int = Field(default=0, ge=0, le=100, description="Project completion percentage")
    start_date: date = Field(..., description="Project start date")
    end_date: date = Field(..., description="Project end date")
    team_deadline: Optional[date] = None
    creative_stats: Optional[CreativeStats] = None

    @field_validator('category', mode='before')
    def parse_category(cls, v):
        if isinstance(v, str):
            parts = [p.strip() for p in v.split(",") if p.strip()]
            cat_map = {
                "development": "Development",
                "creative": "Creative",
                "digitalmarketing": "Digital Marketing",
                "sales": "Sales",
                "webdev": "Development",
                "appdev": "Development",
                "design": "Creative",
                "uiux": "Creative",
                "socialmediamanagement": "Creative",
                "socialmedia": "Creative",
                "smm": "Creative",
                "socialmediamarketing": "Digital Marketing",
                "general": "Development",
            }
            normalized = []
            for p in parts:
                clean_p = p.lower().replace(" ", "").replace("_", "").replace("/", "")
                norm = cat_map.get(clean_p, p)
                if norm not in normalized:
                    normalized.append(norm)
            return ", ".join(normalized) if normalized else v
        return v

    @field_validator('status', mode='before')
    def parse_status(cls, v):
        if isinstance(v, str):
            clean_v = v.lower().replace(" ", "").replace("_", "")
            stat_map = {"notstarted": "Not Started", "inprogress": "In Progress", "inreview": "In Review", "onhold": "On Hold", "completed": "Completed", "cancelled": "Cancelled"}
            return stat_map.get(clean_v, v)
        return v
        
    @field_validator('priority', mode='before')
    def parse_priority(cls, v):
        if isinstance(v, str):
            clean_v = v.lower().replace(" ", "").replace("_", "")
            pri_map = {"low": "Low", "medium": "Medium", "high": "High", "urgent": "Urgent"}
            return pri_map.get(clean_v, v)
        return v

class PaymentEntry(BaseModel):
    """K10: client payment followup entry — date, amount, work period, next reminder."""
    id: Optional[str] = None
    date: Optional[str] = None
    amount: Optional[float] = None
    work_from: Optional[str] = None
    work_to: Optional[str] = None
    next_reminder: Optional[str] = None
    note: Optional[str] = None
    created_by: Optional[str] = None

class DateRangeEntry(BaseModel):
    """Renewal periods — latest (last) range is the default."""
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    label: Optional[str] = None

class ProjectFinanceDetails(BaseModel):
    project_budget: Optional[float] = None
    amount_received: Optional[float] = None
    next_payment_date: Optional[date] = None
    payments: Optional[list[PaymentEntry]] = None

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

class SocialMediaCredential(BaseModel):
    id: Optional[str] = None
    platform: str
    username: str
    password: str
    notes: Optional[str] = None

class DailyMarketingStatCreate(BaseModel):
    date: date
    campaign_name: str
    reach: int = 0
    impressions: int = 0
    leads: int = 0
    followers: int = 0
    revenue: float = 0.0
    spend: float = 0.0
    cost_metric: Optional[float] = None

class DailyMarketingStatUpdate(BaseModel):
    date: Optional[date] = None
    campaign_name: Optional[str] = None
    reach: Optional[int] = None
    impressions: Optional[int] = None
    leads: Optional[int] = None
    followers: Optional[int] = None
    revenue: Optional[float] = None
    spend: Optional[float] = None
    cost_metric: Optional[float] = None

class BulkItem(BaseModel):
    campaign_name: str
    reach: int = 0
    impressions: int = 0
    leads: int = 0
    followers: int = 0
    revenue: float = 0.0
    spend: float = 0.0
    cost_metric: Optional[float] = None

class DailyMarketingStatBulkCreate(BaseModel):
    date: date
    entries: list[BulkItem]

class DailyMarketingStat(BaseModel):
    id: str
    sn: Optional[int] = None
    date: date
    campaign_name: str
    reach: int = 0
    impressions: int = 0
    leads: int = 0
    followers: int = 0
    revenue: float = 0.0
    spend: float = 0.0
    cost_metric: float = 0.0
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)

class TopCampaignItem(BaseModel):
    campaign_name: str
    leads: int = 0
    spend: float = 0.0
    reach: int = 0
    impressions: int = 0
    revenue: float = 0.0
    cpl: float = 0.0


class KpiMetricCard(BaseModel):
    value: float
    formatted: str
    growth_pct: float

class MarketingSummaryMetrics(BaseModel):
    reach: KpiMetricCard
    leads: KpiMetricCard
    cost_per_lead: KpiMetricCard
    amount_spent: KpiMetricCard
    impressions: KpiMetricCard
    revenue: KpiMetricCard

class ProjectTimeline(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None

class ProjectRenewalCreate(BaseModel):
    start_date: date
    end_date: date
    
class ProjectRenewal(BaseModel):
    id: str
    start_date: date
    end_date: date
    renewed_at: datetime
    renewed_by: Optional[str] = None

class MarketingSummaryResponse(BaseModel):
    project_name: str
    timeline: ProjectTimeline
    filters: dict
    kpis: MarketingSummaryMetrics
    top_campaigns: list[TopCampaignItem]

class MarketingWorkspaceResponse(BaseModel):
    header: dict
    timeline: ProjectTimeline
    filters: dict
    kpis: MarketingSummaryMetrics
    top_campaigns: list[TopCampaignItem]
    stats_logs: list[DailyMarketingStat]
    campaign_options: list[str]
    renewal_history: Optional[list[ProjectRenewal]] = []

class MarketingCampaignCreate(BaseModel):
    name: str

class DailyRevenueCreate(BaseModel):
    date: date
    revenue: float = Field(..., ge=0, description="Daily revenue amount in ₹")

class DailyRevenueUpdate(BaseModel):
    revenue: float = Field(..., ge=0, description="Updated revenue amount in ₹")

class DailyRevenue(BaseModel):
    id: str
    date: date
    revenue: float
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)

class ProjectTaskSummaryResponse(BaseModel):
    progress: int = 0
    total_tasks: int = 0
    status_counts: dict = Field(default_factory=dict)
    timeline: ProjectTimeline

class ProjectBase(BaseModel):
    client_id: str = Field(..., description="Client ID this project belongs to")
    general: ProjectGeneralDetails
    creative_team: Optional[CreativeTeam] = None
    whatsapp_group_link: Optional[str] = None
    social_media_credentials: Optional[list[SocialMediaCredential]] = None
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
    content_approvals: Optional[list[ContentCalendarApproval]] = []
    daily_marketing_stats: Optional[list[DailyMarketingStat]] = []
    date_ranges: Optional[list[DateRangeEntry]] = []
    daily_marketing_stats: Optional[list[DailyMarketingStat]] = []
    marketing_campaigns: Optional[list[str]] = []
    daily_revenues: Optional[list[DailyRevenue]] = []
    renewal_history: Optional[list[ProjectRenewal]] = []

class ProjectCreate(ProjectBase):
    pass

class ProjectGeneralUpdate(BaseModel):
    project_name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    status: Optional[ProjectStatus] = None
    priority: Optional[ProjectPriority] = None
    progress: Optional[int] = Field(None, ge=0, le=100)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    team_deadline: Optional[date] = None
    creative_stats: Optional[CreativeStats] = None

    @field_validator('category', mode='before')
    def parse_category(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            parts = [p.strip() for p in v.split(",") if p.strip()]
            cat_map = {
                "development": "Development",
                "creative": "Creative",
                "digitalmarketing": "Digital Marketing",
                "sales": "Sales",
                "webdev": "Development",
                "appdev": "Development",
                "design": "Creative",
                "uiux": "Creative",
                "socialmediamanagement": "Creative",
                "socialmedia": "Creative",
                "smm": "Creative",
                "socialmediamarketing": "Digital Marketing",
                "general": "Development",
            }
            normalized = []
            for p in parts:
                clean_p = p.lower().replace(" ", "").replace("_", "").replace("/", "")
                norm = cat_map.get(clean_p, p)
                if norm not in normalized:
                    normalized.append(norm)
            return ", ".join(normalized) if normalized else v
        return v

    @field_validator('status', mode='before')
    def parse_status(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            clean_v = v.lower().replace(" ", "").replace("_", "")
            stat_map = {"notstarted": "Not Started", "inprogress": "In Progress", "inreview": "In Review", "onhold": "On Hold", "completed": "Completed", "cancelled": "Cancelled"}
            return stat_map.get(clean_v, v)
        return v
        
    @field_validator('priority', mode='before')
    def parse_priority(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            clean_v = v.lower().replace(" ", "").replace("_", "")
            pri_map = {"low": "Low", "medium": "Medium", "high": "High", "urgent": "Urgent"}
            return pri_map.get(clean_v, v)
        return v

class ProjectFinanceUpdate(BaseModel):
    project_budget: Optional[float] = None
    amount_received: Optional[float] = None
    next_payment_date: Optional[date] = None
    payments: Optional[list[PaymentEntry]] = None

class ProjectUpdate(BaseModel):
    client_id: Optional[str] = None
    general: Optional[ProjectGeneralUpdate] = None
    creative_team: Optional[CreativeTeam] = None
    whatsapp_group_link: Optional[str] = None
    social_media_credentials: Optional[list[SocialMediaCredential]] = None
    greetings_msg_sent: Optional[bool] = None
    has_content_calendar: Optional[bool] = None
    followup_schedule_type: Optional[FollowUpScheduleType] = None
    followup_schedule_value: Optional[list[int]] = None
    last_followup_date: Optional[date] = None
    feedback_schedule_type: Optional[FollowUpScheduleType] = None
    feedback_schedule_value: Optional[list[int]] = None
    last_feedback_date: Optional[date] = None
    followup_logs: Optional[list[FollowUpLog]] = None
    daily_marketing_stats: Optional[list[DailyMarketingStat]] = None
    marketing_campaigns: Optional[list[str]] = None
    daily_revenues: Optional[list[DailyRevenue]] = None
    date_ranges: Optional[list[DateRangeEntry]] = None

class ProjectResponse(ProjectBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime
    is_deleted: bool = False
    
    client: Optional[dict] = None
    creative_team_details: Optional[dict] = None
    
    model_config = ConfigDict(populate_by_name=True)
