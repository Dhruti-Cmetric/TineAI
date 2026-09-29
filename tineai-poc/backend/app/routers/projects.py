from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.database import get_db
from app.models.models import Project, License, ClientAssignment, AuditLog, User
from app.auth import get_current_user, require_admin

router = APIRouter(prefix="/api/projects", tags=["projects"])

class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    client_id: int

class LicenseCreate(BaseModel):
    model_config = {"protected_namespaces": ()}
    name: str
    license_type: str = "Research"
    permitted_use: str = ""
    commercial_use: bool = False
    geographic_restriction: str = ""
    exclusivity: bool = False
    redistribution_allowed: bool = False
    model_restriction: str = ""
    duration_days: Optional[int] = None
    access_start: Optional[datetime] = None
    access_end: Optional[datetime] = None
    notes: str = ""

@router.get("/")
def list_projects(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Project)
    if user.role == "client":
        q = q.filter(Project.client_id == user.id)
    projects = q.all()
    return [{"id": p.id, "name": p.name, "description": p.description,
             "client_id": p.client_id,
             "client_name": p.client.name if p.client else None,
             "is_active": p.is_active, "created_at": p.created_at,
             "dataset_count": len([a for a in p.assignments if a.is_active])} for p in projects]

@router.post("/")
def create_project(data: ProjectCreate, db: Session = Depends(get_db), admin=Depends(require_admin)):
    p = Project(name=data.name, description=data.description, client_id=data.client_id)
    db.add(p)
    db.commit()
    db.refresh(p)
    log = AuditLog(actor_id=admin.id, actor_name=admin.name, actor_role=admin.role,
                   action="CREATE_PROJECT", entity_type="Project", entity_id=str(p.id),
                   detail=f"Project '{p.name}' created for client {data.client_id}")
    db.add(log); db.commit()
    return {"id": p.id, "name": p.name, "client_id": p.client_id}

@router.get("/licenses")
def list_licenses(db: Session = Depends(get_db), _=Depends(require_admin)):
    licenses = db.query(License).all()
    return [{"id": l.id, "name": l.name, "license_type": l.license_type,
             "permitted_use": l.permitted_use, "commercial_use": l.commercial_use,
             "geographic_restriction": l.geographic_restriction, "exclusivity": l.exclusivity,
             "redistribution_allowed": l.redistribution_allowed,
             "model_restriction": l.model_restriction,
             "access_start": l.access_start, "access_end": l.access_end,
             "duration_days": l.duration_days, "notes": l.notes,
             "created_at": l.created_at} for l in licenses]

@router.post("/licenses")
def create_license(data: LicenseCreate, db: Session = Depends(get_db), admin=Depends(require_admin)):
    lic = License(**data.model_dump(), created_by_id=admin.id)
    db.add(lic)
    db.commit()
    db.refresh(lic)
    log = AuditLog(actor_id=admin.id, actor_name=admin.name, actor_role=admin.role,
                   action="CREATE_LICENSE", entity_type="License", entity_id=str(lic.id),
                   detail=f"License '{lic.name}' ({lic.license_type}) created")
    db.add(log); db.commit()
    return {"id": lic.id, "name": lic.name, "license_type": lic.license_type}
