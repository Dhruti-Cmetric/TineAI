from pydantic_settings import BaseSettings
import os

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./tineai_poc.db"
    SECRET_KEY: str = "super-secret-poc-key-change-in-prod"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    UPLOAD_DIR: str = "./uploads"

    class Config:
        env_file = "config.env"

settings = Settings()
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
