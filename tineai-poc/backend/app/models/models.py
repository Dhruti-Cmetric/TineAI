from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class UserRole:
    admin = "admin"
    supplier = "supplier"
    client = "client"
    reviewer = "reviewer"


class DatasetStatus:
    draft = "draft"
    uploaded = "uploaded"
    processing = "processing"
    annotated = "annotated"
    under_review = "under_review"
    approved = "approved"
    available = "available"
    restricted = "restricted"
    suspended = "suspended"
    revoked = "revoked"
    archived = "archived"

# Valid state machine transitions (§15 of guide)
VALID_TRANSITIONS = {
    "draft":        ["uploaded"],
    "uploaded":     ["processing"],
    "processing":   ["annotated", "under_review"],
    "annotated":    ["under_review"],
    "under_review": ["approved", "processing"],
    "approved":     ["available", "restricted", "suspended"],
    "available":    ["restricted", "suspended", "revoked"],
    "restricted":   ["available", "suspended", "revoked"],
    "suspended":    ["available", "revoked"],
    "revoked":      ["archived"],
}


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120))
    email = Column(String(200), unique=True, index=True)
    hashed_password = Column(String(256))
    role = Column(String(20), default="supplier")
    organization = Column(String(200))   # company name
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    datasets = relationship("Dataset", back_populates="supplier")
    api_keys = relationship("APIKey", back_populates="client")


class Dataset(Base):
    __tablename__ = "datasets"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200))
    description = Column(Text)
    data_type = Column(String(50))
    language = Column(String(100))
    country = Column(String(100))
    dialect = Column(String(100))
    accent = Column(String(100))
    cultural_context = Column(Text)
    source = Column(String(200))
    collection_details = Column(Text)
    file_size_mb = Column(Float, default=0)
    file_formats = Column(String(200))
    file_path = Column(String(500))
    status = Column(String(30), default="uploaded")
    quality_score = Column(Float, nullable=True)
    annotation_details = Column(Text)
    transcription_text = Column(Text)
    translation_text = Column(Text)
    diarization_info = Column(Text)
    rights_info = Column(Text)
    permitted_uses = Column(Text)
    restrictions = Column(Text)
    privacy_info = Column(Text)
    version = Column(String(20), default="1.0")
    reject_reason = Column(Text)
    supplier_id = Column(Integer, ForeignKey("users.id"))
    supplier = relationship("User", back_populates="datasets")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    assignments = relationship("ClientAssignment", back_populates="dataset")
    versions = relationship("DatasetVersion", back_populates="dataset")
    processing_tasks = relationship("ProcessingTask", back_populates="dataset")
    reviews = relationship("Review", back_populates="dataset")


class DatasetVersion(Base):
    __tablename__ = "dataset_versions"
    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"))
    version_number = Column(String(20))
    status = Column(String(30), default="pending")
    change_notes = Column(Text)
    file_count = Column(Integer, default=0)
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    dataset = relationship("Dataset", back_populates="versions")
    created_by = relationship("User", foreign_keys=[created_by_id])


class ProcessingTask(Base):
    __tablename__ = "processing_tasks"
    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"))
    task_type = Column(String(100))   # transcription, diarization, quality_check, annotation
    status = Column(String(30), default="pending")   # pending, processing, completed, failed
    result_text = Column(Text)
    confidence = Column(Float, nullable=True)
    file_name = Column(String(300))
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    dataset = relationship("Dataset", back_populates="processing_tasks")


class Review(Base):
    __tablename__ = "reviews"
    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"))
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewer_name = Column(String(120))
    decision = Column(String(20))   # pass, fail, changes_requested
    transcription_quality = Column(String(20))   # correct, incorrect, partial
    annotation_quality = Column(String(20))
    dialect_accuracy = Column(String(20))
    comments = Column(Text)
    corrections = Column(Text)
    submitted_at = Column(DateTime, default=datetime.utcnow)
    dataset = relationship("Dataset", back_populates="reviews")
    reviewer = relationship("User", foreign_keys=[reviewer_id])


class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200))
    description = Column(Text)
    client_id = Column(Integer, ForeignKey("users.id"))
    client = relationship("User", foreign_keys=[client_id])
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    assignments = relationship("ClientAssignment", back_populates="project")


class License(Base):
    __tablename__ = "licenses"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200))
    license_type = Column(String(100))    # Commercial, Research, Non-Commercial
    permitted_use = Column(Text)
    commercial_use = Column(Boolean, default=False)
    geographic_restriction = Column(String(300))
    exclusivity = Column(Boolean, default=False)
    redistribution_allowed = Column(Boolean, default=False)
    model_restriction = Column(Text)
    duration_days = Column(Integer, nullable=True)
    access_start = Column(DateTime, nullable=True)
    access_end = Column(DateTime, nullable=True)
    notes = Column(Text)
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    assignments = relationship("ClientAssignment", back_populates="license")


class ClientAssignment(Base):
    __tablename__ = "client_assignments"
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("users.id"))
    dataset_id = Column(Integer, ForeignKey("datasets.id"))
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    license_id = Column(Integer, ForeignKey("licenses.id"), nullable=True)
    project_name = Column(String(200))   # kept for backward compat
    license_type = Column(String(100), default="Research")
    permitted_use = Column(Text)
    access_start = Column(DateTime, default=datetime.utcnow)
    access_end = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    client = relationship("User", foreign_keys=[client_id])
    dataset = relationship("Dataset", back_populates="assignments")
    project = relationship("Project", back_populates="assignments")
    license = relationship("License", back_populates="assignments")
    created_at = Column(DateTime, default=datetime.utcnow)


class APIKey(Base):
    __tablename__ = "api_keys"
    id = Column(Integer, primary_key=True, index=True)
    key_hash = Column(String(256), unique=True, index=True)
    key_prefix = Column(String(20))
    client_id = Column(Integer, ForeignKey("users.id"))
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    client = relationship("User", back_populates="api_keys")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    actor_name = Column(String(120))
    actor_role = Column(String(50))
    action = Column(String(200))
    entity_type = Column(String(100))
    entity_id = Column(String(100))
    detail = Column(Text)
    ip_address = Column(String(50))
    timestamp = Column(DateTime, default=datetime.utcnow)
