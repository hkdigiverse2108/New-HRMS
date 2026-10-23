from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

# --- Accounts ---
class SocialAccountCreate(BaseModel):
    ig_account_id: str
    username: str
    access_token: str
    brand_id: Optional[str] = None
    is_active: bool = True
    force: bool = False

class SocialAccountUpdate(BaseModel):
    username: Optional[str] = None
    access_token: Optional[str] = None
    brand_id: Optional[str] = None
    is_active: Optional[bool] = None

class SocialAccountResponse(BaseModel):
    id: str
    ig_account_id: str
    username: str
    brand_id: Optional[str] = None
    is_active: bool
    has_token: bool = True
    token_last4: str
    token_updated_at: Optional[datetime] = None
    days_since_refresh: Optional[int] = None
    last_refresh_status: Optional[str] = None
    last_webhook_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# --- Keywords ---
class SocialKeywordCreate(BaseModel):
    username: Optional[str] = None  # Account handle
    ig_account_id: Optional[str] = None  # Instagram Account ID
    keyword: str
    message: str
    scope: Optional[str] = "ALL_POSTS"
    post_link: Optional[str] = ""
    media_url: Optional[str] = ""
    media_id: Optional[str] = ""
    comment_reply1: str
    comment_reply2: Optional[str] = ""
    comment_reply3: Optional[str] = ""
    require_follow: bool = True
    desc: Optional[str] = ""

class SocialKeywordUpdate(BaseModel):
    username: Optional[str] = None
    ig_account_id: Optional[str] = None
    keyword: Optional[str] = None
    message: Optional[str] = None
    scope: Optional[str] = None
    post_link: Optional[str] = None
    media_url: Optional[str] = None
    media_id: Optional[str] = None
    comment_reply1: Optional[str] = None
    comment_reply2: Optional[str] = None
    comment_reply3: Optional[str] = None
    require_follow: Optional[bool] = None
    desc: Optional[str] = None
    is_active: Optional[bool] = None

class SocialKeywordResponse(BaseModel):
    id: str
    ig_account_id: str
    username: str
    keyword: str
    keyword_norm: str
    message: str
    scope: str = "ALL_POSTS"
    post_link: Optional[str] = ""
    media_url: Optional[str] = ""
    media_id: str = ""
    media_source: str = "none"
    comment_reply1: str
    comment_reply2: Optional[str] = ""
    comment_reply3: Optional[str] = ""
    require_follow: bool = True
    desc: str
    is_active: bool = True
    hit_count: int = 0
    last_hit_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class KeywordTestMatchRequest(BaseModel):
    comment_text: str
    media_id: Optional[str] = ""

class KeywordTestMatchResponse(BaseModel):
    matched: bool
    reason: str
    normalized_comment: str
    rule_id: Optional[str] = None

# --- Pending DMs ---
class SocialPendingDmResponse(BaseModel):
    id: str
    ig_account_id: str
    username: Optional[str] = ""
    igsid_masked: str
    keyword: str
    message: str
    comment_id: str
    media_id: Optional[str] = ""
    created_at: datetime
    expire_at: datetime
    ttl_minutes: int
    seconds_remaining: int

# --- Event Logs ---
class SocialEventLogResponse(BaseModel):
    id: str
    ts: datetime
    level: str = "info"  # info | warn | error
    type: str
    status: str = "ok"  # ok | skip | error
    ig_account_id: Optional[str] = None
    username: Optional[str] = None
    actor: str = "system"
    message: str = ""
    detail: Dict[str, Any] = {}
    error_code: Optional[int] = None
    error_subcode: Optional[int] = None
    hint: Optional[str] = None
    duration_ms: Optional[int] = None

# --- Brands ---
class SocialBrandCreate(BaseModel):
    brand_id: str
    brand_name: str
    link: Optional[str] = ""
    ig_id: Optional[str] = ""
    industry: Optional[str] = ""
    about: Optional[str] = ""
    products_services: List[str] = []
    usps: List[str] = []
    target_audience: Optional[str] = ""
    audience_age: Optional[str] = ""
    audience_interests: List[str] = []
    city: Optional[str] = ""
    state: Optional[str] = ""
    country: Optional[str] = ""
    service_area: Optional[str] = ""
    goal: Optional[str] = ""
    tone: Optional[str] = ""
    caption_language: str = "English"
    default_cta: Optional[str] = ""
    always_include_hashtags: List[str] = []
    never_use_hashtags: List[str] = []
    notes: Optional[str] = ""
    is_active: bool = True

class SocialBrandUpdate(BaseModel):
    brand_name: Optional[str] = None
    link: Optional[str] = None
    ig_id: Optional[str] = None
    industry: Optional[str] = None
    about: Optional[str] = None
    products_services: Optional[List[str]] = None
    usps: Optional[List[str]] = None
    target_audience: Optional[str] = None
    audience_age: Optional[str] = None
    audience_interests: Optional[List[str]] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    service_area: Optional[str] = None
    goal: Optional[str] = None
    tone: Optional[str] = None
    caption_language: Optional[str] = None
    default_cta: Optional[str] = None
    always_include_hashtags: Optional[List[str]] = None
    never_use_hashtags: Optional[List[str]] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

class SocialBrandResponse(SocialBrandCreate):
    id: str
    accounts_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# --- AI Jobs ---
class SocialJobResponse(BaseModel):
    id: str
    kind: str
    status: str  # queued | running | done | failed
    step: str
    progress: int
    error: Optional[str] = None
    engine: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None

# --- Reel Scripts ---
class ReelScriptJobCreate(BaseModel):
    brand_id: str
    topic: str
    purpose: str
    language: str = "Hinglish"
    ref_url: Optional[str] = ""
    note: Optional[str] = ""

class ReelScriptReviseRequest(BaseModel):
    script_id: Optional[str] = None
    previous_text: Optional[str] = None
    request: str

class ReelScriptSelectRequest(BaseModel):
    selected_hook: int
    selected_cta: int

class SocialScriptResponse(BaseModel):
    id: str
    brand_id: str
    brand_name: Optional[str] = ""
    topic: str
    purpose: str
    language: str
    note: Optional[str] = ""
    ref_url: Optional[str] = ""
    hooks: List[str]
    script_text: str
    ctas: List[str]
    selected_hook: Optional[int] = None
    selected_cta: Optional[int] = None
    final_text: Optional[str] = None
    revisions: List[Dict[str, Any]] = []
    created_by: str
    created_at: datetime
    updated_at: datetime

# --- Captions ---
class CaptionJobCreate(BaseModel):
    brand_id: str
    language: str = "english"
    details: Optional[str] = ""
    mode: str = "text"  # text | drive | image
    drive_folder_url: Optional[str] = None
    script_text: Optional[str] = None

# --- Settings ---
class SocialSettingsUpdate(BaseModel):
    GEMINI_SCRIPT_MODEL: Optional[str] = None
    GEMINI_VIDEO_MODEL: Optional[str] = None
    GEMINI_MEDIA_MODEL: Optional[str] = None
    GROQ_TEXT_MODEL: Optional[str] = None
    GROQ_VISION_MODEL: Optional[str] = None
    SOCIAL_LOG_RETENTION_DAYS: Optional[int] = None
    SOCIAL_ALLOW_SELF_COMMENTS: Optional[bool] = None
    pending_ttl_minutes: Optional[int] = None
    caption_cooldown_seconds: Optional[int] = None
    allowed_telegram_reel_chat_ids: Optional[List[int]] = None
    allowed_telegram_caption_chat_ids: Optional[List[int]] = None

class SocialSettingsResponse(BaseModel):
    public_webhook_url: str
    meta_verify_token_configured: bool
    meta_app_secret_configured: bool
    models: Dict[str, str]
    key_configured: Dict[str, bool]
    retention_days: int
    allow_self_comments: bool
    pending_ttl_minutes: int
    caption_cooldown_seconds: int
    allowed_telegram_reel_chat_ids: List[int]
    allowed_telegram_caption_chat_ids: List[int]
    log_stats: Dict[str, Any]

class ProviderTestResponse(BaseModel):
    ok: bool
    message: str
    latency_ms: Optional[int] = None

# --- Overview KPI ---
class SocialOverviewResponse(BaseModel):
    active_accounts: int
    active_keywords: int
    pending_dms: int
    dms_sent_24h: int
    dms_sent_7d: int
    dms_failed_24h: int
    tokens_needing_attention: int
    recent_events: List[SocialEventLogResponse] = []
    webhook_health: List[Dict[str, Any]] = []
