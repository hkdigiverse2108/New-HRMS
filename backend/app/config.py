from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Application configuration
    PORT: int
    
    # Redis configuration
    REDIS_URL: str
    
    # MongoDB Settings
    MONGODB_URL: str
    MONGODB_DB_NAME: str

    # JWT Settings
    SECRET_KEY: str
    ALGORITHM: str


    # Email Settings
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    SENDER_EMAIL: str = ""

    class Config:
        env_file = "../.env"
        extra = "ignore"

settings = Settings()
