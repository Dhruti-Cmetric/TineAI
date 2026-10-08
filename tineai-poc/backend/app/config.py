from pydantic_settings import BaseSettings, SettingsConfigDict
import os

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="config.env", extra="ignore")

    DATABASE_URL: str = "sqlite:///./tineai_poc.db"
    SECRET_KEY: str = "super-secret-poc-key-change-in-prod"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    UPLOAD_DIR: str = "./uploads"
    HF_TOKEN: str = ""
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"

settings = Settings()
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
