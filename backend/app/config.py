from pathlib import Path
from pydantic_settings import BaseSettings

BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent

class Settings(BaseSettings):
    # Application configuration
    PORT: int = 8000
    
    # Redis configuration
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # MongoDB Settings
    MONGODB_URL: str
    MONGODB_DB_NAME: str = "new_hrms_db"

    # JWT Settings
    SECRET_KEY: str = "8a84ec3d0b10d94752c9ecebbcfca8857d9b2837f5ba1e8c3627b675afd42c99"
    ALGORITHM: str = "HS256"

    # Email Settings
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    SENDER_EMAIL: str = ""

    class Config:
        env_file = [
            str(ROOT_DIR / ".env"),
            str(BACKEND_DIR / ".env"),
            ".env",
            "../.env"
        ]
        extra = "ignore"

settings = Settings()
