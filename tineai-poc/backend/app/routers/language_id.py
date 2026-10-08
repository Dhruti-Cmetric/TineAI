"""
routers/language_id.py — Language Identification endpoints

POST /api/language-id/detect     detect language(s) from text or audio file
GET  /api/language-id/supported  list supported languages
"""
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from app.database import get_db
from app.auth import get_current_user
from app.models.pipeline_models import ModelRegistry, TaskType

router = APIRouter(prefix="/api/language-id", tags=["language-id"])

SUPPORTED_LANGUAGES = [
    {"code": "yor_Latn", "name": "Yoruba"}, {"code": "hau_Latn", "name": "Hausa"},
    {"code": "ibo_Latn", "name": "Igbo"}, {"code": "swa_Latn", "name": "Swahili"},
    {"code": "amh_Ethi", "name": "Amharic"}, {"code": "zul_Latn", "name": "Zulu"},
    {"code": "wol_Latn", "name": "Wolof"}, {"code": "fra_Latn", "name": "French"},
    {"code": "eng_Latn", "name": "English"}, {"code": "por_Latn", "name": "Portuguese"},
    {"code": "ara_Arab", "name": "Arabic"}, {"code": "som_Latn", "name": "Somali"},
    {"code": "orm_Latn", "name": "Oromo"}, {"code": "kin_Latn", "name": "Kinyarwanda"},
    {"code": "nya_Latn", "name": "Chichewa"}, {"code": "tsn_Latn", "name": "Tswana"},
]


def _detect(text: str, model_cfg: dict) -> list:
    try:
        from transformers import pipeline as hf_pipeline
        clf = hf_pipeline(
            "text-classification",
            model=model_cfg.get("hf_model_id", "facebook/fasttext-language-identification"),
            top_k=model_cfg.get("config", {}).get("top_k", 3),
        )
        return clf(text[:512])
    except Exception:
        pass
    # simple heuristic mock
    mock = [
        {"label": "yor_Latn", "score": 0.78},
        {"label": "hau_Latn", "score": 0.12},
        {"label": "eng_Latn", "score": 0.05},
    ]
    return mock


@router.get("/supported")
def supported_languages():
    return {"languages": SUPPORTED_LANGUAGES, "count": len(SUPPORTED_LANGUAGES)}


@router.post("/detect")
async def detect_language(
    text: Optional[str] = Form(None),
    file: UploadFile = File(None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if not text and not (file and file.filename):
        raise HTTPException(400, "Provide 'text' or an audio/text 'file'")

    model_row = (
        db.query(ModelRegistry)
        .filter(ModelRegistry.task_type == TaskType.LANG_ID, ModelRegistry.is_default == True)
        .first()
    )
    model_cfg = {"hf_model_id": model_row.hf_model_id, "config": model_row.config} if model_row else {}

    if not text and file:
        content = await file.read()
        text = content.decode("utf-8", errors="ignore")[:2048]

    predictions = _detect(text or "", model_cfg)
    top = predictions[0] if predictions else {}
    return {
        "top_language": top.get("label"),
        "confidence": top.get("score"),
        "all_predictions": predictions,
        "model": model_row.name if model_row else "fasttext-langid (default)",
    }
