"""
routers/models.py — Model Registry CRUD

GET    /api/models                  list all models (filter by task_type)
POST   /api/models                  register a new model (admin)
GET    /api/models/{id}             get model detail
PATCH  /api/models/{id}             update model (admin)
DELETE /api/models/{id}             deactivate model (admin)
POST   /api/models/{id}/set-default set as default for its task_type (admin)
POST   /api/models/seed-defaults    seed default models from pipeline_config (admin)
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.auth import require_admin, get_current_user
from app.models.pipeline_models import ModelRegistry
from app.pipeline_config import PIPELINE_DEFAULTS

router = APIRouter(prefix="/api/models", tags=["model-registry"])


class ModelIn(BaseModel):
    name: str
    task_type: str
    provider: Optional[str] = None
    version: Optional[str] = "latest"
    hf_model_id: Optional[str] = None
    local_path: Optional[str] = None
    language_support: Optional[str] = "all"
    is_default: Optional[bool] = False
    config: Optional[dict] = {}
    notes: Optional[str] = None


class ModelOut(BaseModel):
    id: int
    name: str
    task_type: str
    provider: Optional[str]
    version: Optional[str]
    hf_model_id: Optional[str]
    local_path: Optional[str]
    language_support: Optional[str]
    is_default: bool
    is_active: bool
    config: Optional[dict]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


@router.get("/", response_model=List[ModelOut])
def list_models(
    task_type: Optional[str] = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    q = db.query(ModelRegistry)
    if task_type:
        q = q.filter(ModelRegistry.task_type == task_type)
    if active_only:
        q = q.filter(ModelRegistry.is_active == True)
    return q.order_by(ModelRegistry.task_type, ModelRegistry.name).all()


@router.post("/", response_model=ModelOut)
def register_model(body: ModelIn, db: Session = Depends(get_db), user=Depends(require_admin)):
    # if marked default, unset existing default for this task_type
    if body.is_default:
        db.query(ModelRegistry).filter(
            ModelRegistry.task_type == body.task_type, ModelRegistry.is_default == True
        ).update({"is_default": False})
    m = ModelRegistry(**body.model_dump())
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


@router.get("/{model_id}", response_model=ModelOut)
def get_model(model_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    m = db.query(ModelRegistry).filter(ModelRegistry.id == model_id).first()
    if not m:
        raise HTTPException(404, "Model not found")
    return m


@router.patch("/{model_id}", response_model=ModelOut)
def update_model(
    model_id: int, body: ModelIn, db: Session = Depends(get_db), user=Depends(require_admin)
):
    m = db.query(ModelRegistry).filter(ModelRegistry.id == model_id).first()
    if not m:
        raise HTTPException(404, "Model not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(m, k, v)
    db.commit()
    db.refresh(m)
    return m


@router.delete("/{model_id}")
def deactivate_model(model_id: int, db: Session = Depends(get_db), user=Depends(require_admin)):
    m = db.query(ModelRegistry).filter(ModelRegistry.id == model_id).first()
    if not m:
        raise HTTPException(404, "Model not found")
    m.is_active = False
    db.commit()
    return {"id": m.id, "is_active": False}


@router.post("/{model_id}/set-default")
def set_default(model_id: int, db: Session = Depends(get_db), user=Depends(require_admin)):
    m = db.query(ModelRegistry).filter(ModelRegistry.id == model_id).first()
    if not m:
        raise HTTPException(404, "Model not found")
    db.query(ModelRegistry).filter(
        ModelRegistry.task_type == m.task_type, ModelRegistry.is_default == True
    ).update({"is_default": False})
    m.is_default = True
    db.commit()
    return {"id": m.id, "task_type": m.task_type, "is_default": True}


@router.post("/seed-defaults")
def seed_defaults(db: Session = Depends(get_db), user=Depends(require_admin)):
    seeded = []
    for task_type, cfg in PIPELINE_DEFAULTS.items():
        exists = db.query(ModelRegistry).filter(
            ModelRegistry.task_type == task_type, ModelRegistry.name == cfg["name"]
        ).first()
        if exists:
            seeded.append({"task_type": task_type, "name": cfg["name"], "action": "exists"})
            continue
        m = ModelRegistry(
            name=cfg["name"],
            task_type=task_type,
            provider=cfg.get("provider"),
            hf_model_id=cfg.get("hf_model_id"),
            language_support=cfg.get("language_support", "all"),
            is_default=True,
            config=cfg.get("config", {}),
        )
        db.add(m)
        seeded.append({"task_type": task_type, "name": cfg["name"], "action": "created"})
    db.commit()
    return {"seeded": seeded}
