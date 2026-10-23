from pathlib import Path
from pydantic_settings import BaseSettings

BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent

class Settings(BaseSettings):
    # Application configuration
    PORT: int = 8000
    VITE_API_URL: str = "http://localhost:8000"
    admin_email: str = "admin@hrms.local"
    
    # Redis configuration
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # MongoDB Settings
    MONGODB_URL: str
    MONGODB_DB_NAME: str = "new_hrms_db"

    # JWT Settings
    SECRET_KEY: str = "8a84ec3d0b10d94752c9ecebbcfca8857d9b2837f5ba1e8c3627b675afd42c99"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_HOURS: int = 10

    # Email Settings
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    SENDER_EMAIL: str = ""

    # Google OAuth & Calendar Integration Settings
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = ""
    FRONTEND_SCHEDULE_URL: str = ""
    FRONTEND_URL: str = "http://localhost:7788"

    # Social Automation Settings (Instagram / AI / Webhooks)
    META_VERIFY_TOKEN: str = ""
    META_APP_SECRET: str = ""
    IG_GRAPH_BASE: str = "https://graph.instagram.com"
    IG_GRAPH_BASE_URL: str = "https://graph.instagram.com"
    IG_GRAPH_VERSION: str = "v21.0"
    SOCIAL_ALLOW_SELF_COMMENTS: bool = False
    SOCIAL_ENC_KEY: str = ""
    TOKEN_ENCRYPTION_KEY: str = ""
    INTERNAL_API_KEY: str = ""
    N8N_WEBHOOK_SECRET: str = ""
    INTERNAL_REQUIRE_SIGNATURE: bool = False
    INTERNAL_ALLOW_REMOTE: bool = False
    N8N_BASE_URL: str = ""
    N8N_API_KEY: str = ""
    SOCIAL_LOG_RETENTION_DAYS: int = 2
    SOCIAL_LOG_FILE_ENABLED: bool = True
    PUBLIC_BASE_URL: str = ""

    # Social AI Providers
    GEMINI_API_KEY: str = ""
    GROQ_API_KEY_1: str = ""
    GROQ_API_KEY_2: str = ""
    GEMINI_SCRIPT_MODEL: str = "gemini-3.1-flash-lite"
    GEMINI_VIDEO_MODEL: str = "gemini-3.5-flash-lite"
    GEMINI_MEDIA_MODEL: str = "gemini-3.8-flash"
    GROQ_TEXT_MODEL: str = "openai/gpt-oss-120b"
    GROQ_VISION_MODEL: str = "qwen/qwen3.8-27b"

    # Google Drive for Social Automation
    GOOGLE_SERVICE_ACCOUNT_JSON: str = ""

    # Telegram Adapters (Optional)
    TELEGRAM_REEL_BOT_TOKEN: str = ""
    TELEGRAM_CAPTION_BOT_TOKEN: str = ""
    TELEGRAM_WEBHOOK_SECRET: str = ""

    class Config:
        env_file = [
            str(ROOT_DIR / ".env"),
            str(BACKEND_DIR / ".env"),
            ".env",
            "../.env"
        ]
        extra = "ignore"

settings = Settings()
