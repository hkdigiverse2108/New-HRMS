from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Application configuration
    PORT: int
    
    # Redis configuration
    REDIS_URL: str
    
    # MongoDB Settings
    MONGODB_URL: str
    MONGODB_DB_NAME: str

    class Config:
        env_file = ".env"

settings = Settings()
