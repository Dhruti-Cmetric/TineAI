from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.database import engine, SessionLocal
from app.models.models import Base
from app.routers import auth, users, datasets, access, audit, projects
from app.routers import models as model_registry
from app.routers import pipeline, language_id, ocr, translation, tts
import app.models.pipeline_models  # noqa: register pipeline tables
from app.config import settings
import os

Base.metadata.create_all(bind=engine)


def _auto_seed_models():
    """Seed default model registry entries on first startup."""
    from app.models.pipeline_models import ModelRegistry
    from app.pipeline_config import PIPELINE_DEFAULTS
    db = SessionLocal()
    try:
        for task_type, cfg in PIPELINE_DEFAULTS.items():
            exists = db.query(ModelRegistry).filter(ModelRegistry.task_type == task_type).first()
            if not exists:
                db.add(ModelRegistry(
                    name=cfg["name"], task_type=task_type,
                    provider=cfg.get("provider"), hf_model_id=cfg.get("hf_model_id"),
                    language_support=cfg.get("language_support", "all"),
                    is_default=True, config=cfg.get("config", {}),
                ))
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()

_auto_seed_models()

app = FastAPI(
    title="TINE AI Data Platform",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", "http://localhost:3001", "http://localhost:3002",
        "http://localhost:5173", "http://localhost:8001", "http://localhost:8002",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(datasets.router)
app.include_router(access.router)
app.include_router(audit.router)
app.include_router(projects.router)
app.include_router(model_registry.router)
app.include_router(pipeline.router)
app.include_router(language_id.router)
app.include_router(ocr.router)
app.include_router(translation.router)
app.include_router(tts.router)

if os.path.exists(settings.UPLOAD_DIR):
    app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

@app.get("/")
def root():
    return {"message": "TINE AI Data Platform API", "version": "0.2.0", "docs": "/docs"}
