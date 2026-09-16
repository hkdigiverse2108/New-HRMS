from pydantic import BaseModel, Field, ConfigDict, field_validator
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

class Campaign(BaseModel):
    name: str
    status: CampaignStatus = Field(default=CampaignStatus.ACTIVE)

class ProjectBase(BaseModel):
    client_id: str = Field(..., description="Client ID this project belongs to")
    general: ProjectGeneralDetails
    finance: Optional[ProjectFinanceDetails] = None
    campaigns: Optional[list[Campaign]] = Field(default=None, description="Marketing campaigns")

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

class ProjectResponse(ProjectBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime
    is_deleted: bool = False
    
    client: Optional[dict] = None
    
    model_config = ConfigDict(populate_by_name=True)
