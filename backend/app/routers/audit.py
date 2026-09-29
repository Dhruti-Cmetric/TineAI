from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models.models import AuditLog
from app.auth import get_current_user, require_admin

router = APIRouter(prefix="/api/audit", tags=["audit"])

@router.get("/")
def list_audit_logs(
    entity_type: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    q = db.query(AuditLog)
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if action:
        q = q.filter(AuditLog.action.ilike(f"%{action}%"))
    logs = q.order_by(AuditLog.timestamp.desc()).limit(limit).all()
    return [
        {"id": l.id, "actor": l.actor_name, "role": l.actor_role,
         "action": l.action, "entity_type": l.entity_type,
         "entity_id": l.entity_id, "detail": l.detail,
         "timestamp": l.timestamp}
        for l in logs
    ]

@router.get("/stats")
def audit_stats(db: Session = Depends(get_db), _=Depends(require_admin)):
    from app.models.models import Dataset, APIKey, ClientAssignment, Project
    return {
        "total_logs": db.query(AuditLog).count(),
        "datasets_total": db.query(Dataset).count(),
        "datasets_approved": db.query(Dataset).filter(Dataset.status.in_(["approved","available"])).count(),
        "datasets_pending": db.query(Dataset).filter(Dataset.status == "under_review").count(),
        "datasets_uploaded": db.query(Dataset).filter(Dataset.status == "uploaded").count(),
        "active_api_keys": db.query(APIKey).filter(APIKey.is_active == True).count(),
        "active_assignments": db.query(ClientAssignment).filter(ClientAssignment.is_active == True).count(),
        "projects_total": db.query(Project).count(),
    }
