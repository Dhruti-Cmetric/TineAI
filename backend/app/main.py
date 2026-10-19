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
    """
    Upsert default model registry entries on startup.
    Demotes old defaults when the config changes (e.g. whisper-base → whisper-large-v3).
    """
    from app.models.pipeline_models import ModelRegistry
    from app.pipeline_config import PIPELINE_DEFAULTS
    db = SessionLocal()
    try:
        for task_type, cfg in PIPELINE_DEFAULTS.items():
            by_name = db.query(ModelRegistry).filter(
                ModelRegistry.task_type == task_type,
                ModelRegistry.name == cfg["name"]
            ).first()
            if by_name:
                # Keep config in sync
                by_name.config = cfg.get("config", {})
                by_name.hf_model_id = cfg.get("hf_model_id")
                if not by_name.is_default:
                    db.query(ModelRegistry).filter(
                        ModelRegistry.task_type == task_type, ModelRegistry.is_default == True
                    ).update({"is_default": False})
                    by_name.is_default = True
            else:
                # Demote previous default for this task_type (name changed)
                db.query(ModelRegistry).filter(
                    ModelRegistry.task_type == task_type, ModelRegistry.is_default == True
                ).update({"is_default": False})
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

def _auto_seed_demo_data():
    """Seed initial demo accounts and datasets if database has no users (e.g. fresh Render deploy)."""
    from app.models.models import User
    import logging
    _log = logging.getLogger(__name__)
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            _log.info("Fresh database detected — auto-seeding demo data...")
            import subprocess, sys
            seed_script = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "seed.py")
            if os.path.exists(seed_script):
                subprocess.run([sys.executable, seed_script], check=True)
                _log.info("Demo data auto-seeded successfully.")
    except Exception as exc:
        _log.warning("Demo data auto-seeding error: %s", exc)
    finally:
        db.close()

_auto_seed_demo_data()
_auto_seed_models()

app = FastAPI(
    title="TINE AI Data Platform",
    version="0.2.0",
)

allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
origins = [
    "http://localhost:3000", "http://localhost:3001", "http://localhost:3002",
    "http://localhost:5173", "http://localhost:8001", "http://localhost:8002",
]
if allowed_origins_env and allowed_origins_env != "*":
    origins.extend([o.strip() for o in allowed_origins_env.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allowed_origins_env == "*" else origins,
    allow_origin_regex=r"https://.*\.onrender\.com" if allowed_origins_env != "*" else None,
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
