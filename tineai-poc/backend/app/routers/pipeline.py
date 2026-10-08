"""
routers/pipeline.py — Pipeline trigger & status endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.auth import get_current_user, require_admin
from app.models.models import Dataset, AuditLog
from app.models.pipeline_models import PipelineJob, PipelineStep, TaskType, ALL_TASK_TYPES

router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])

# default steps per data type — ORDER matters (steps run sequentially)
DATA_TYPE_STEPS = {
    "audio": [
        TaskType.QUALITY_CHECK,
        TaskType.LANG_ID,
        TaskType.STT,
        TaskType.DIARIZATION,
        TaskType.TRANSLATION,
        TaskType.TEXT_UNDERSTANDING,
        TaskType.TTS,
    ],
    "video": [
        # 1. extract frames + metadata
        TaskType.VIDEO_PROCESSING,
        # 2. audio-based chain (worker extracts audio automatically)
        TaskType.QUALITY_CHECK,
        TaskType.LANG_ID,
        TaskType.STT,
        TaskType.DIARIZATION,
        TaskType.TRANSLATION,
        TaskType.TEXT_UNDERSTANDING,
        TaskType.TTS,
    ],
    "image": [
        TaskType.QUALITY_CHECK,
        TaskType.OCR,
        TaskType.LANG_ID,
        TaskType.TEXT_UNDERSTANDING,
        TaskType.IMAGE_ANNOTATION,
    ],
    "text": [
        TaskType.LANG_ID,
        TaskType.TEXT_UNDERSTANDING,
        TaskType.TRANSLATION,
        TaskType.TTS,
        TaskType.QUALITY_CHECK,
    ],
    "document": [
        TaskType.OCR,
        TaskType.LANG_ID,
        TaskType.TEXT_UNDERSTANDING,
        TaskType.TRANSLATION,
        TaskType.QUALITY_CHECK,
    ],
}


class PipelineRunRequest(BaseModel):
    steps: Optional[List[str]] = None          # if None → auto-detect from data_type
    src_lang: Optional[str] = None
    tgt_lang: Optional[str] = "eng_Latn"
    understanding_task: Optional[str] = "classification"


class StepOut(BaseModel):
    id: int
    task_type: str
    status: str
    confidence: Optional[float]
    duration_seconds: Optional[float]
    result_json: Optional[dict]
    error_message: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class JobOut(BaseModel):
    id: int
    dataset_id: int
    status: str
    celery_task_id: Optional[str]
    pipeline_config: Optional[dict]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    error_message: Optional[str]
    created_at: datetime
    steps: List[StepOut]

    class Config:
        from_attributes = True


def _try_enqueue(job_id: int):
    """Send job to Celery; if broker unavailable, run synchronously (dev fallback)."""
    try:
        from app.worker import run_full_pipeline
        run_full_pipeline.delay(job_id)
        return "queued"
    except Exception:
        try:
            from app.worker import run_full_pipeline
            run_full_pipeline(job_id)
            return "sync"
        except Exception:
            return "enqueue_failed"


@router.post("/run/{dataset_id}")
def trigger_pipeline(
    dataset_id: int,
    body: PipelineRunRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(404, "Dataset not found")

    # determine steps
    requested_steps = body.steps or DATA_TYPE_STEPS.get(ds.data_type, [TaskType.QUALITY_CHECK])

    # validate step names
    invalid = [s for s in requested_steps if s not in ALL_TASK_TYPES]
    if invalid:
        raise HTTPException(400, f"Unknown task types: {invalid}. Valid: {ALL_TASK_TYPES}")

    cfg = body.model_dump(exclude_unset=True)

    job = PipelineJob(
        dataset_id=dataset_id,
        triggered_by_id=user.id,
        status="pending",
        pipeline_config=cfg,
    )
    db.add(job)
    db.flush()  # get job.id

    for task_type in requested_steps:
        step = PipelineStep(
            job_id=job.id,
            task_type=task_type,
            status="pending",
            input_ref=ds.file_path,
        )
        db.add(step)

    db.commit()
    db.refresh(job)

    # update dataset status to processing
    if ds.status in ("uploaded", "annotated"):
        ds.status = "processing"
        db.commit()

    log = AuditLog(
        actor_id=user.id, actor_name=user.name, actor_role=user.role,
        action="PIPELINE_TRIGGERED", entity_type="PipelineJob", entity_id=str(job.id),
        detail=f"Pipeline started for dataset '{ds.name}' — steps: {requested_steps}",
    )
    db.add(log)
    db.commit()

    mode = _try_enqueue(job.id)
    return {"job_id": job.id, "status": job.status, "steps": requested_steps, "mode": mode}


@router.get("/jobs", response_model=List[JobOut])
def list_jobs(
    dataset_id: Optional[int] = None,
    status: Optional[str] = None,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    q = db.query(PipelineJob)
    if user.role == "supplier":
        # only jobs for their datasets
        q = q.join(Dataset).filter(Dataset.supplier_id == user.id)
    if dataset_id:
        q = q.filter(PipelineJob.dataset_id == dataset_id)
    if status:
        q = q.filter(PipelineJob.status == status)
    return q.order_by(PipelineJob.created_at.desc()).limit(limit).all()


@router.get("/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    job = db.query(PipelineJob).filter(PipelineJob.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@router.post("/jobs/{job_id}/retry")
def retry_job(job_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    job = db.query(PipelineJob).filter(PipelineJob.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status not in ("failed", "completed"):
        raise HTTPException(400, f"Cannot retry job in status '{job.status}'")

    # reset failed steps to pending
    for step in job.steps:
        if step.status == "failed":
            step.status = "pending"
            step.error_message = None
            step.started_at = None
            step.completed_at = None
    job.status = "pending"
    job.error_message = None
    db.commit()

    mode = _try_enqueue(job.id)
    return {"job_id": job.id, "status": "pending", "mode": mode}


@router.post("/steps/{step_id}/retry")
def retry_step(step_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    step = db.query(PipelineStep).filter(PipelineStep.id == step_id).first()
    if not step:
        raise HTTPException(404, "Step not found")
    step.status = "pending"
    step.error_message = None
    step.started_at = None
    step.completed_at = None
    db.commit()
    try:
        from app.worker import run_single_step
        run_single_step.delay(step_id)
        return {"step_id": step_id, "status": "queued"}
    except Exception as exc:
        return {"step_id": step_id, "status": "enqueue_failed", "error": str(exc)}


@router.delete("/jobs/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_db), user=Depends(require_admin)):
    job = db.query(PipelineJob).filter(PipelineJob.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    db.delete(job)
    db.commit()
    return {"deleted": job_id}


@router.get("/stats")
def pipeline_stats(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Aggregate pipeline statistics for dashboard widgets."""
    total   = db.query(func.count(PipelineJob.id)).scalar() or 0
    running = db.query(func.count(PipelineJob.id)).filter(PipelineJob.status == "running").scalar() or 0
    pending = db.query(func.count(PipelineJob.id)).filter(PipelineJob.status == "pending").scalar() or 0
    done    = db.query(func.count(PipelineJob.id)).filter(PipelineJob.status == "completed").scalar() or 0
    failed  = db.query(func.count(PipelineJob.id)).filter(PipelineJob.status == "failed").scalar() or 0

    steps_total     = db.query(func.count(PipelineStep.id)).scalar() or 0
    steps_completed = db.query(func.count(PipelineStep.id)).filter(PipelineStep.status == "completed").scalar() or 0
    steps_failed    = db.query(func.count(PipelineStep.id)).filter(PipelineStep.status == "failed").scalar() or 0

    # per task_type completion count
    task_counts = db.query(
        PipelineStep.task_type, func.count(PipelineStep.id)
    ).filter(PipelineStep.status == "completed").group_by(PipelineStep.task_type).all()

    return {
        "jobs": {"total": total, "running": running, "pending": pending, "completed": done, "failed": failed},
        "steps": {"total": steps_total, "completed": steps_completed, "failed": steps_failed},
        "by_task_type": {tt: cnt for tt, cnt in task_counts},
    }
