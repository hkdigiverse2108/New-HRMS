export interface SocialAccount {
  id: string;
  ig_account_id: string;
  username: string;
  brand_id?: string | null | undefined;
  is_active: boolean;
  has_token: boolean;
  token_last4: string;
  token_updated_at?: string | null | undefined;
  days_since_refresh?: number | null | undefined;
  last_refresh_status?: string | null | undefined;
  last_webhook_at?: string | null | undefined;
  created_at?: string | null | undefined;
  updated_at?: string | null | undefined;
}

export interface SocialMediaItem {
  id: string;
  type: "REEL" | "POST";
  media_type?: string | null | undefined;
  media_url?: string | null | undefined;
  caption?: string | null | undefined;
  permalink?: string | null | undefined;
  timestamp?: string | null | undefined;
  thumbnail_url?: string | null | undefined;
  shortcode?: string | null | undefined;
}

export interface SocialKeyword {
  id: string;
  ig_account_id: string;
  username?: string | null | undefined;
  keyword: string;
  keyword_norm: string;
  media_id?: string | null | undefined;
  media_url?: string | null | undefined;
  post_link?: string | null | undefined;
  scope: "ALL_POSTS" | "SPECIFIC_POSTS";
  message: string;
  comment_reply1: string;
  comment_reply2?: string | null | undefined;
  comment_reply3?: string | null | undefined;
  require_follow: boolean;
  desc: string;
  is_active: boolean;
  hit_count: number;
  last_hit_at?: string | null | undefined;
  created_at?: string | null | undefined;
  updated_at?: string | null | undefined;
}

export interface SocialPendingDm {
  id: string;
  ig_account_id: string;
  username?: string | null | undefined;
  igsid_masked: string;
  keyword: string;
  message: string;
  comment_id: string;
  media_id?: string | null | undefined;
  created_at: string;
  expire_at: string;
  ttl_minutes: number;
  seconds_remaining: number;
}

export interface SocialEventLog {
  id: string;
  ts: string;
  level: "info" | "warn" | "error";
  type: string;
  status: "ok" | "skip" | "error";
  ig_account_id?: string | null | undefined;
  username?: string | null | undefined;
  actor: string;
  message: string;
  detail: Record<string, unknown>;
  error_code?: number | null | undefined;
  error_subcode?: number | null | undefined;
  hint?: string | null | undefined;
  duration_ms?: number | null | undefined;
}

export interface SocialBrand {
  id: string;
  brand_id: string;
  brand_name: string;
  link?: string | null | undefined;
  ig_id?: string | null | undefined;
  industry?: string | null | undefined;
  about?: string | null | undefined;
  products_services: string[];
  usps: string[];
  target_audience?: string | null | undefined;
  audience_age?: string | null | undefined;
  audience_interests: string[];
  city?: string | null | undefined;
  state?: string | null | undefined;
  country?: string | null | undefined;
  service_area?: string | null | undefined;
  goal?: string | null | undefined;
  tone?: string | null | undefined;
  caption_language: string;
  default_cta?: string | null | undefined;
  always_include_hashtags: string[];
  never_use_hashtags: string[];
  notes?: string | null | undefined;
  is_active: boolean;
  accounts_count?: number | null | undefined;
  created_at?: string | null | undefined;
  updated_at?: string | null | undefined;
}

export interface HookVariant {
  hook_number?: number | undefined;
  visual_action?: string | undefined;
  spoken_words?: string | undefined;
  on_screen_text?: string | undefined;
}

export interface SceneItem {
  scene_number?: number | undefined;
  visual_action?: string | undefined;
  spoken_words?: string | undefined;
  on_screen_text?: string | undefined;
  duration_sec?: number | undefined;
}

export interface SocialScript {
  id: string;
  title: string;
  topic: string;
  brand_id?: string | null | undefined;
  brand_name?: string | null | undefined;
  target_duration_sec: number;
  hooks: HookVariant[];
  scenes: SceneItem[];
  ctas: string[];
  production_notes?: string | null | undefined;
  status: "draft" | "approved" | "recorded" | "published";
  revision_count: number;
  is_favorited: boolean;
  last_feedback?: string | null | undefined;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CaptionAngleResult {
  topic_summary?: string | undefined;
  angle_a_direct?: string | undefined;
  angle_b_story?: string | undefined;
  angle_d_debate?: string | undefined;
  hashtags?: {
    high_reach?: string[] | undefined;
    mid_reach?: string[] | undefined;
    long_tail?: string[] | undefined;
    full_set?: string | undefined;
  } | undefined;
  seo_keywords?: string[] | undefined;
  alt_text?: string | undefined;
}

export interface CaptionGenerationResponse {
  topic: string;
  brand_id?: string | null | undefined;
  brand_name?: string | null | undefined;
  result: CaptionAngleResult;
  created_at: string;
}

export interface SocialSettingsData {
  config: {
    META_VERIFY_TOKEN: string;
    META_APP_SECRET_SET: boolean;
    IG_GRAPH_VERSION: string;
    PUBLIC_BASE_URL: string;
    GEMINI_API_KEY_SET: boolean;
    GROQ_API_KEY_1_SET: boolean;
    GROQ_API_KEY_2_SET: boolean;
    DEFAULT_GEMINI_MODEL: string;
    DEFAULT_GROQ_MODEL: string;
  };
  retention_days: number;
  allow_self_comments: boolean;
  pending_ttl_minutes: number;
  caption_cooldown_seconds: number;
  log_stats: {
    total_logs: number;
    oldest_log_ts?: string | null | undefined;
  };
}

export interface SocialOverviewData {
  total_accounts: number;
  active_accounts: number;
  total_keywords: number;
  active_keywords: number;
  pending_dms: number;
  total_brands: number;
  summary_24h: Record<string, number>;
  recent_events: SocialEventLog[];
  server_time: string;
}
