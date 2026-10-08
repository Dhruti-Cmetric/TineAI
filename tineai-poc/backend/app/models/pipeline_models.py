"""
Pipeline-specific DB models:
  - ModelRegistry   : catalogue of AI models per task type
  - PipelineJob     : one full pipeline run per dataset
  - PipelineStep    : per-step result inside a job
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class TaskType:
    STT = "speech_to_text"
    DIARIZATION = "diarization"
    TRANSLATION = "translation"
    SPEECH_TRANSLATION = "speech_translation"
    TEXT_UNDERSTANDING = "text_understanding"
    TTS = "text_to_speech"
    LANG_ID = "language_identification"
    OCR = "ocr"
    IMAGE_ANNOTATION = "image_annotation"
    VIDEO_PROCESSING = "video_processing"
    QUALITY_CHECK = "quality_check"
    CUSTOM_TRAINING = "custom_training"


ALL_TASK_TYPES = [v for k, v in TaskType.__dict__.items() if not k.startswith("_")]


class ModelRegistry(Base):
    """Catalogue of AI models — one row per model variant."""
    __tablename__ = "model_registry"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)           # e.g. "whisper-large-v3"
    task_type = Column(String(60), nullable=False, index=True)
    provider = Column(String(100))                       # openai, meta, huggingface…
    version = Column(String(50), default="latest")
    hf_model_id = Column(String(300))                    # HuggingFace model id
    local_path = Column(String(500))                     # local cache / fine-tuned path
    language_support = Column(Text)                      # comma-sep ISO codes or "all"
    is_default = Column(Boolean, default=False)          # active model for this task_type
    is_active = Column(Boolean, default=True)
    config = Column(JSON, default={})                    # extra kwargs forwarded to model
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    pipeline_steps = relationship("PipelineStep", back_populates="model")


class PipelineJob(Base):
    """One full pipeline run attached to a dataset."""
    __tablename__ = "pipeline_jobs"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False, index=True)
    triggered_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    celery_task_id = Column(String(200))                 # Celery async result id
    status = Column(String(30), default="pending")       # pending|running|completed|failed
    pipeline_config = Column(JSON, default={})           # steps requested
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    dataset = relationship("Dataset")
    triggered_by = relationship("User", foreign_keys=[triggered_by_id])
    steps = relationship("PipelineStep", back_populates="job", cascade="all, delete-orphan")


class PipelineStep(Base):
    """One task/step inside a pipeline job."""
    __tablename__ = "pipeline_steps"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("pipeline_jobs.id"), nullable=False, index=True)
    model_id = Column(Integer, ForeignKey("model_registry.id"), nullable=True)
    task_type = Column(String(60), nullable=False)
    status = Column(String(30), default="pending")       # pending|running|completed|failed|skipped
    input_ref = Column(Text)                             # file path or upstream step id
    output_ref = Column(Text)                            # output file path or inline result
    result_json = Column(JSON)                           # structured result payload
    confidence = Column(Float, nullable=True)
    duration_seconds = Column(Float, nullable=True)
    error_message = Column(Text)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    job = relationship("PipelineJob", back_populates="steps")
    model = relationship("ModelRegistry", back_populates="pipeline_steps")
