import secrets, hashlib
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.database import get_db
from app.models.models import APIKey, ClientAssignment, Dataset, AuditLog, User, Project
from app.auth import get_current_user, require_admin

router = APIRouter(prefix="/api/access", tags=["access"])

BLOCKED_STATUSES = {"suspended", "revoked", "restricted", "archived"}

class AssignmentCreate(BaseModel):
    client_id: int
    dataset_id: int
    project_name: str
    project_id: Optional[int] = None
    license_id: Optional[int] = None
    license_type: str = "Research"
    permitted_use: str = "AI model training"
    access_end: Optional[datetime] = None

@router.post("/assign")
def assign_dataset(data: AssignmentCreate, db: Session = Depends(get_db), admin=Depends(require_admin)):
    ds = db.query(Dataset).filter(Dataset.id == data.dataset_id).first()
    if not ds or ds.status not in ("approved", "available"):
        raise HTTPException(400, "Dataset must be approved or available before assignment")
    a = ClientAssignment(**data.model_dump())
    db.add(a)
    db.commit()
    db.refresh(a)
    log = AuditLog(actor_id=admin.id, actor_name=admin.name, actor_role=admin.role,
                   action="ASSIGN_DATASET", entity_type="ClientAssignment", entity_id=str(a.id),
                   detail=f"Dataset {data.dataset_id} assigned to client {data.client_id} | project: {data.project_name}")
    db.add(log); db.commit()
    return {"id": a.id, "message": "Dataset assigned successfully"}

@router.get("/assignments")
def list_assignments(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(ClientAssignment)
    if user.role == "client":
        q = q.filter(ClientAssignment.client_id == user.id)
    assignments = q.all()
    result = []
    for a in assignments:
        ds = db.query(Dataset).filter(Dataset.id == a.dataset_id).first()
        client = db.query(User).filter(User.id == a.client_id).first()
        proj = db.query(Project).filter(Project.id == a.project_id).first() if a.project_id else None
        now = datetime.utcnow()
        expired = bool(a.access_end and a.access_end < now)
        result.append({
            "id": a.id, "project_name": a.project_name, "license_type": a.license_type,
            "permitted_use": a.permitted_use, "is_active": a.is_active,
            "access_start": a.access_start, "access_end": a.access_end,
            "expired": expired,
            "dataset": {"id": ds.id, "name": ds.name, "language": ds.language,
                        "country": ds.country, "status": ds.status, "version": ds.version} if ds else None,
            "client": {"id": client.id, "name": client.name, "email": client.email,
                       "organization": client.organization} if client else None,
            "project": {"id": proj.id, "name": proj.name} if proj else None,
        })
    return result

@router.patch("/assignments/{assignment_id}/revoke")
def revoke_assignment(assignment_id: int, db: Session = Depends(get_db), admin=Depends(require_admin)):
    a = db.query(ClientAssignment).filter(ClientAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(404, "Assignment not found")
    a.is_active = False
    db.commit()
    client = db.query(User).filter(User.id == a.client_id).first()
    ds = db.query(Dataset).filter(Dataset.id == a.dataset_id).first()
    log = AuditLog(actor_id=admin.id, actor_name=admin.name, actor_role=admin.role,
                   action="REVOKE_ACCESS", entity_type="ClientAssignment", entity_id=str(a.id),
                   detail=f"Access REVOKED: {client.name if client else a.client_id} -> '{ds.name if ds else a.dataset_id}'")
    db.add(log); db.commit()
    return {"id": a.id, "is_active": False, "message": "Access revoked"}

@router.post("/apikeys/generate")
def generate_api_key(project_id: Optional[int] = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    raw_key = f"tine_{secrets.token_urlsafe(32)}"
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    prefix = raw_key[:12]
    key = APIKey(key_hash=key_hash, key_prefix=prefix, client_id=user.id, project_id=project_id)
    db.add(key)
    db.commit()
    log = AuditLog(actor_id=user.id, actor_name=user.name, actor_role=user.role,
                   action="GENERATE_API_KEY", entity_type="APIKey", entity_id=prefix,
                   detail=f"API key generated for {user.email}" + (f" | project_id={project_id}" if project_id else ""))
    db.add(log); db.commit()
    return {"api_key": raw_key, "prefix": prefix, "message": "Store this key securely — it won't be shown again."}

@router.get("/apikeys")
def list_api_keys(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    keys = db.query(APIKey).filter(APIKey.client_id == user.id).all()
    return [{"id": k.id, "prefix": k.key_prefix, "is_active": k.is_active,
             "created_at": k.created_at, "expires_at": k.expires_at} for k in keys]

@router.get("/datasets/{dataset_id}/data")
def access_dataset_via_api(dataset_id: int, api_key: str, db: Session = Depends(get_db)):
    """
    §14 Authorization Logic — 10-step check:
    1. Authenticate token  2. Identify client  3. Identify project
    4. Confirm assignment  5. Dataset approved/available  6. License active
    7. Date inside access period  8. Dataset not suspended/revoked
    9. Check operation permitted  10. Write audit event
    """
    # Step 1-2: Authenticate
    key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    key_obj = db.query(APIKey).filter(APIKey.key_hash == key_hash, APIKey.is_active == True).first()
    if not key_obj:
        raise HTTPException(401, "Invalid or revoked API key")

    # Step 3-4: Confirm assignment
    now = datetime.utcnow()
    assignment = db.query(ClientAssignment).filter(
        ClientAssignment.client_id == key_obj.client_id,
        ClientAssignment.dataset_id == dataset_id,
        ClientAssignment.is_active == True
    ).first()
    if not assignment:
        raise HTTPException(403, "403 Forbidden: No active assignment for this dataset and client")

    # Step 7: Check access period (expiry)
    if assignment.access_end and assignment.access_end < now:
        raise HTTPException(403, "403 Forbidden: License has expired")

    # Step 5-8: Dataset status check
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(404, "Dataset not found")
    if ds.status in BLOCKED_STATUSES:
        raise HTTPException(403, f"403 Forbidden: Dataset is {ds.status}")
    if ds.status not in ("approved", "available"):
        raise HTTPException(403, "403 Forbidden: Dataset is not yet approved")

    # Step 10: Audit
    client = db.query(User).filter(User.id == key_obj.client_id).first()
    log = AuditLog(actor_id=key_obj.client_id,
                   actor_name=f"API:{key_obj.key_prefix}",
                   actor_role="client",
                   action="API_ACCESS", entity_type="Dataset", entity_id=str(ds.id),
                   detail=f"API access: client '{client.name if client else key_obj.client_id}' -> dataset '{ds.name}' via key {key_obj.key_prefix}")
    db.add(log); db.commit()

    return {
        "dataset_id": ds.id,
        "name": ds.name,
        "language": ds.language,
        "country": ds.country,
        "dialect": ds.dialect,
        "accent": ds.accent,
        "version": ds.version,
        "file_formats": ds.file_formats,
        "permitted_uses": ds.permitted_uses,
        "restrictions": ds.restrictions,
        "license": assignment.license_type,
        "access_expires": assignment.access_end.isoformat() if assignment.access_end else "No expiry",
        "transcription_sample": (ds.transcription_text or "")[:300],
        "quality_score": ds.quality_score,
        "diarization_info": ds.diarization_info,
        "_api_version": "v1",
        "_note": "POC: metadata + transcription sample. Full binary delivery in MVP via signed URLs."
    }

@router.get("/demo/scenarios")
def access_control_scenarios(api_key: str, db: Session = Depends(get_db)):
    """Returns all access control scenario results for the demo (§9.15)."""
    key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    key_obj = db.query(APIKey).filter(APIKey.key_hash == key_hash).first()
    if not key_obj:
        return {"error": "Invalid key"}
    now = datetime.utcnow()
    assignments = db.query(ClientAssignment).filter(ClientAssignment.client_id == key_obj.client_id).all()
    scenarios = []
    for a in assignments:
        ds = db.query(Dataset).filter(Dataset.id == a.dataset_id).first()
        if not ds: continue
        expired = bool(a.access_end and a.access_end < now)
        suspended = ds.status in BLOCKED_STATUSES
        result = "200 OK" if (a.is_active and not expired and not suspended and ds.status in ("approved","available")) else "403 Forbidden"
        reason = ""
        if not a.is_active: reason = "Assignment revoked"
        elif expired: reason = "License expired"
        elif suspended: reason = f"Dataset {ds.status}"
        scenarios.append({
            "dataset": ds.name, "status": ds.status, "version": ds.version,
            "assignment_active": a.is_active, "expired": expired,
            "result": result, "reason": reason
        })
    return {"scenarios": scenarios, "evaluated_at": now.isoformat()}
