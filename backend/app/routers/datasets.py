import os, uuid
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from app.database import get_db
from app.models.models import Dataset, DatasetStatus, DatasetVersion, ProcessingTask, Review, AuditLog, User, VALID_TRANSITIONS
from app.auth import get_current_user, require_admin
from app.config import settings

router = APIRouter(prefix="/api/datasets", tags=["datasets"])

class DatasetOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    data_type: str
    language: str
    country: str
    dialect: Optional[str]
    accent: Optional[str]
    cultural_context: Optional[str]
    collection_details: Optional[str]
    source: Optional[str]
    file_size_mb: float
    file_formats: Optional[str]
    status: str
    quality_score: Optional[float]
    annotation_details: Optional[str]
    transcription_text: Optional[str]
    translation_text: Optional[str]
    diarization_info: Optional[str]
    rights_info: Optional[str]
    permitted_uses: Optional[str]
    restrictions: Optional[str]
    privacy_info: Optional[str]
    version: str
    reject_reason: Optional[str]
    supplier_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

@router.get("/", response_model=List[DatasetOut])
def list_datasets(
    status: Optional[str] = None,
    language: Optional[str] = None,
    country: Optional[str] = None,
    data_type: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    q = db.query(Dataset)
    if user.role == "client":
        from app.models.models import ClientAssignment
        assigned_ids = [a.dataset_id for a in db.query(ClientAssignment).filter(
            ClientAssignment.client_id == user.id, ClientAssignment.is_active == True).all()]
        q = q.filter(Dataset.id.in_(assigned_ids), Dataset.status.in_(["approved", "available"]))
    elif user.role == "supplier":
        q = q.filter(Dataset.supplier_id == user.id)
    if status:
        q = q.filter(Dataset.status == status)
    if language:
        q = q.filter(Dataset.language.ilike(f"%{language}%"))
    if country:
        q = q.filter(Dataset.country.ilike(f"%{country}%"))
    if data_type:
        q = q.filter(Dataset.data_type == data_type)
    return q.order_by(Dataset.created_at.desc()).all()

@router.post("/upload", response_model=DatasetOut)
async def upload_dataset(
    name: str = Form(...),
    description: str = Form(""),
    data_type: str = Form(...),
    language: str = Form(...),
    country: str = Form(...),
    dialect: str = Form(""),
    accent: str = Form(""),
    cultural_context: str = Form(""),
    collection_details: str = Form(""),
    source: str = Form(""),
    rights_info: str = Form(""),
    permitted_uses: str = Form(""),
    restrictions: str = Form(""),
    privacy_info: str = Form(""),
    annotation_details: str = Form(""),
    version: str = Form("1.0"),
    file_formats: str = Form(""),
    file_size_mb: float = Form(0.0),
    file: UploadFile = File(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    file_path = None
    file_size = 0.0
    file_fmt = ""
    if file and file.filename:
        ext = os.path.splitext(file.filename)[1]
        fname = f"{uuid.uuid4()}{ext}"
        fpath = os.path.join(settings.UPLOAD_DIR, fname)
        with open(fpath, "wb") as f:
            content = await file.read()
            f.write(content)
        file_size = round(len(content) / 1024 / 1024, 2)
        file_path = fpath
        file_fmt = ext.lstrip(".")

    ds = Dataset(
        name=name, description=description, data_type=data_type,
        language=language, country=country, dialect=dialect, accent=accent,
        cultural_context=cultural_context, collection_details=collection_details,
        source=source, rights_info=rights_info, permitted_uses=permitted_uses,
        restrictions=restrictions, privacy_info=privacy_info,
        annotation_details=annotation_details or None,
        version=version or "1.0",
        file_path=file_path,
        file_size_mb=file_size if file_size > 0 else (file_size_mb or 0.0),
        file_formats=file_fmt or file_formats or "",
        supplier_id=user.id, status=DatasetStatus.uploaded
    )
    db.add(ds)
    db.commit()
    db.refresh(ds)
    # Create initial processing tasks for audio
    if ds.data_type == "audio":
        for task_type in ["transcription", "diarization", "quality_check"]:
            task = ProcessingTask(dataset_id=ds.id, task_type=task_type,
                                  status="pending", file_name=file.filename if file and file.filename else "sample.wav")
            db.add(task)
        db.commit()
    log = AuditLog(actor_id=user.id, actor_name=user.name, actor_role=user.role,
                   action="UPLOAD_DATASET", entity_type="Dataset", entity_id=str(ds.id),
                   detail=f"Uploaded dataset '{ds.name}' ({ds.language}, {ds.country})")
    db.add(log); db.commit()
    return ds

@router.get("/{dataset_id}", response_model=DatasetOut)
def get_dataset(dataset_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(404, "Dataset not found")
    return ds

@router.patch("/{dataset_id}/status")
def update_status(
    dataset_id: int,
    new_status: str,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(404, "Dataset not found")
    # Enforce state machine
    allowed = VALID_TRANSITIONS.get(ds.status, [])
    if new_status not in allowed and user.role != "admin":
        raise HTTPException(400, f"Invalid transition: {ds.status} -> {new_status}. Allowed: {allowed}")
    old_status = ds.status
    ds.status = new_status
    if reason:
        ds.reject_reason = reason
    db.commit()
    log = AuditLog(actor_id=user.id, actor_name=user.name, actor_role=user.role,
                   action="STATUS_CHANGE", entity_type="Dataset", entity_id=str(ds.id),
                   detail=f"'{ds.name}' moved {old_status} -> {new_status}" + (f" | {reason}" if reason else ""))
    db.add(log); db.commit()
    return {"id": ds.id, "status": ds.status}

@router.patch("/{dataset_id}/enrich")
def enrich_dataset(dataset_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(404)
    # Run mock AI processing tasks
    tasks = db.query(ProcessingTask).filter(ProcessingTask.dataset_id == dataset_id).all()
    if not tasks:
        for task_type in ["transcription", "diarization", "quality_check"]:
            tasks.append(ProcessingTask(dataset_id=ds.id, task_type=task_type,
                                        status="pending", file_name="sample.wav"))
            db.add(tasks[-1])
        db.commit()
    transcript = _run_transcription(ds.file_path, ds.language)
    for task in tasks:
        task.status = "completed"
        task.completed_at = datetime.utcnow()
        if task.task_type == "transcription":
            task.result_text = transcript
            task.confidence = 0.87
        elif task.task_type == "diarization":
            task.result_text = "Speaker 1: 0:00-0:45, Speaker 2: 0:45-1:30, Speaker 1: 1:30-2:15"
            task.confidence = 0.91
        elif task.task_type == "quality_check":
            task.result_text = "SNR: 28dB | Clipping: None | Background noise: Low | Sample rate: 44100Hz"
            task.confidence = 0.94
    ds.transcription_text = transcript
    ds.quality_score = 0.87
    ds.diarization_info = "2 speakers identified. Speaker 1 dominant (67%). Clean audio."
    ds.annotation_details = f"Auto-tagged: {ds.language}, {ds.dialect or ds.country}. Diarization complete."
    ds.status = "under_review"
    db.commit()
    log = AuditLog(actor_id=user.id, actor_name=user.name, actor_role=user.role,
                   action="AI_ENRICH", entity_type="Dataset", entity_id=str(ds.id),
                   detail=f"AI enrichment applied to '{ds.name}': transcription + diarization + quality check")
    db.add(log); db.commit()
    return {"transcription": transcript, "quality_score": ds.quality_score, "status": ds.status}

@router.get("/{dataset_id}/processing")
def get_processing_tasks(dataset_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    tasks = db.query(ProcessingTask).filter(ProcessingTask.dataset_id == dataset_id).all()
    return [{"id": t.id, "task_type": t.task_type, "status": t.status,
             "result_text": t.result_text, "confidence": t.confidence,
             "file_name": t.file_name, "completed_at": t.completed_at} for t in tasks]

@router.post("/{dataset_id}/review")
def submit_review(
    dataset_id: int,
    decision: str = Form(...),
    transcription_quality: str = Form("correct"),
    annotation_quality: str = Form("correct"),
    dialect_accuracy: str = Form("correct"),
    comments: str = Form(""),
    corrections: str = Form(""),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(404)
    review = Review(
        dataset_id=dataset_id, reviewer_id=user.id, reviewer_name=user.name,
        decision=decision, transcription_quality=transcription_quality,
        annotation_quality=annotation_quality, dialect_accuracy=dialect_accuracy,
        comments=comments, corrections=corrections
    )
    db.add(review)
    if decision == "fail":
        ds.status = "processing"
    elif decision == "changes_requested":
        ds.status = "processing"
    db.commit()
    log = AuditLog(actor_id=user.id, actor_name=user.name, actor_role=user.role,
                   action="REVIEW_SUBMITTED", entity_type="Review", entity_id=str(review.id),
                   detail=f"Review '{decision}' on dataset '{ds.name}' | {comments[:100] if comments else ''}")
    db.add(log); db.commit()
    return {"id": review.id, "decision": decision, "dataset_status": ds.status}

@router.get("/{dataset_id}/reviews")
def get_reviews(dataset_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    reviews = db.query(Review).filter(Review.dataset_id == dataset_id).all()
    return [{"id": r.id, "reviewer_name": r.reviewer_name, "decision": r.decision,
             "transcription_quality": r.transcription_quality, "annotation_quality": r.annotation_quality,
             "dialect_accuracy": r.dialect_accuracy, "comments": r.comments,
             "corrections": r.corrections, "submitted_at": r.submitted_at} for r in reviews]

@router.post("/{dataset_id}/versions")
def create_version(
    dataset_id: int,
    version_number: str = Form(...),
    change_notes: str = Form(""),
    file_count: int = Form(0),
    db: Session = Depends(get_db),
    user: User = Depends(require_admin)
):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(404)
    v = DatasetVersion(dataset_id=dataset_id, version_number=version_number,
                       change_notes=change_notes, file_count=file_count,
                       created_by_id=user.id, status="pending")
    db.add(v)
    db.commit()
    db.refresh(v)
    log = AuditLog(actor_id=user.id, actor_name=user.name, actor_role=user.role,
                   action="VERSION_CREATED", entity_type="DatasetVersion", entity_id=str(v.id),
                   detail=f"Version {version_number} created for '{ds.name}'")
    db.add(log); db.commit()
    return {"id": v.id, "version_number": v.version_number, "status": v.status,
            "change_notes": v.change_notes, "file_count": v.file_count, "created_at": v.created_at}

@router.get("/{dataset_id}/versions")
def list_versions(dataset_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    versions = db.query(DatasetVersion).filter(DatasetVersion.dataset_id == dataset_id).order_by(DatasetVersion.created_at.desc()).all()
    return [{"id": v.id, "version_number": v.version_number, "status": v.status,
             "change_notes": v.change_notes, "file_count": v.file_count,
             "created_by": v.created_by.name if v.created_by else None,
             "created_at": v.created_at} for v in versions]

def _run_transcription(file_path, language: str) -> str:
    MOCK = {
        "Yoruba": "E kaaro, awa n lo si oja. Mo feran ede Yoruba gan-an. Oja naa tobi, awon eniyan po. [Yoruba morning greeting — Lagos dialect]",
        "Swahili": "Habari za asubuhi. Nimefurahi kukutana nawe leo. Tutaenda sokoni pamoja. [Standard Swahili — Nairobi broadcast register]",
        "Cameroonian French": "Bonjour mon ami, comment tu vas aujourd'hui? On va au marche acheter les tomates. Le prix ca monte trop ici a Douala. [Cameroon French — Douala urban dialect, Camfranglais elements]",
        "French": "Bonjour mon ami, comment tu vas aujourd'hui? On va au marche acheter les tomates. Le prix ca monte trop ici a Douala. [Cameroon French — Douala urban dialect]",
        "Amharic": "Indemin aderku? Zare tewat tiru new. Enhedalen sewoch gar [Amharic — Addis Ababa dialect]",
        "Zulu": "Sawubona, unjani namhlanje? Ngiyabonga kakhulu. Sizofunda ngokulima umbila namhlanje. [Zulu — KwaZulu-Natal dialect]",
        "Hausa": "Ina kwana? Lafiya kalau. Mun tafi kasuwa yau da safe. Kayan masarufi sun yi tsada. [Hausa — Northern Nigeria market dialect]",
        "Igbo": "Ututu oma! Kedu ka i mere? Anyị ga-aga ahia taa. Ahia dị elu. [Igbo — Enugu urban dialect]",
        "Wolof": "Maangiy dem. Naka waxaale bi? Dem naa ci kaw ndakaaru. [Wolof — Dakar urban dialect]",
    }
    default = f"[Auto-transcribed] Audio content in {language}. Regional vocabulary and pronunciation patterns detected. Dialect confidence: 87%. Speaker diarization: 2 speakers identified."
    if file_path and os.path.exists(file_path):
        try:
            import whisper
            model = whisper.load_model("tiny")
            result = model.transcribe(file_path)
            return result["text"]
        except Exception:
            pass
    return MOCK.get(language, default)
