import sys; sys.path.insert(0,'.')
import app.models.models  # noqa: register Dataset etc first
from app.database import SessionLocal
from app.models.pipeline_models import ModelRegistry
db = SessionLocal()
rows = db.query(ModelRegistry).filter(ModelRegistry.is_active==True).order_by(ModelRegistry.task_type).all()
for r in rows:
    ls = (r.language_support or "")[:40]
    d  = "[DEFAULT]" if r.is_default else ""
    print(f"{r.task_type}|{r.name}|{r.hf_model_id}|{r.provider}|{d}|{ls}")
db.close()
