from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from app.database import get_db
from app.models.models import User, UserRole, AuditLog
from app.auth import require_admin, hash_password, get_current_user
from datetime import datetime

router = APIRouter(prefix="/api/users", tags=["users"])

class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str = "supplier"

class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    class Config:
        from_attributes = True

@router.get("/", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db), admin=Depends(require_admin)):
    return db.query(User).all()

@router.post("/", response_model=UserOut)
def create_user(data: UserCreate, db: Session = Depends(get_db), admin=Depends(require_admin)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(400, "Email already exists")
    user = User(name=data.name, email=data.email,
                hashed_password=hash_password(data.password), role=data.role)
    db.add(user)
    db.commit()
    db.refresh(user)
    log = AuditLog(actor_id=admin.id, actor_name=admin.name, actor_role=admin.role,
                   action="CREATE_USER", entity_type="User", entity_id=str(user.id),
                   detail=f"Created user {user.email} with role {user.role}")
    db.add(log); db.commit()
    return user

@router.patch("/{user_id}/toggle")
def toggle_user(user_id: int, db: Session = Depends(get_db), admin=Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    user.is_active = not user.is_active
    db.commit()
    return {"id": user.id, "is_active": user.is_active}

@router.get("/stats")
def stats(db: Session = Depends(get_db), _=Depends(require_admin)):
    return {
        "total_users": db.query(User).count(),
        "suppliers": db.query(User).filter(User.role == "supplier").count(),
        "clients": db.query(User).filter(User.role == "client").count(),
        "admins": db.query(User).filter(User.role == "admin").count(),
    }
