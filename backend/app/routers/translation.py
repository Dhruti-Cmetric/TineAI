"""
routers/translation.py — Translation endpoints

POST /api/translation/translate     translate text (NLLB-200 / AfriNLLB)
GET  /api/translation/languages     list supported language pairs
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.auth import get_current_user
from app.models.pipeline_models import ModelRegistry, TaskType

router = APIRouter(prefix="/api/translation", tags=["translation"])

NLLB_LANGS = [
    "eng_Latn", "fra_Latn", "por_Latn", "ara_Arab",
    "swa_Latn", "yor_Latn", "hau_Latn", "ibo_Latn",
    "amh_Ethi", "zul_Latn", "wol_Latn", "som_Latn",
    "orm_Latn", "kin_Latn", "nya_Latn", "tsn_Latn",
    "lin_Latn", "lug_Latn", "tir_Ethi", "sot_Latn",
]


class TranslateRequest(BaseModel):
    model_config = {"protected_namespaces": ()}

    text: str
    src_lang: str = "yor_Latn"
    tgt_lang: str = "eng_Latn"
    model_override: Optional[str] = None   # optional HF model id


def _translate(text: str, src_lang: str, tgt_lang: str, hf_model_id: str, max_length: int) -> str:
    try:
        from transformers import pipeline as hf_pipeline
        pipe = hf_pipeline(
            "translation",
            model=hf_model_id,
            src_lang=src_lang,
            tgt_lang=tgt_lang,
            max_length=max_length,
        )
        return pipe(text)[0]["translation_text"]
    except Exception:
        return f"[MOCK TRANSLATION] '{text[:80]}' from {src_lang} → {tgt_lang}"


@router.get("/languages")
def list_languages():
    return {"languages": NLLB_LANGS, "count": len(NLLB_LANGS)}


@router.post("/translate")
def translate(
    body: TranslateRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if not body.text.strip():
        raise HTTPException(400, "text is empty")

    model_row = (
        db.query(ModelRegistry)
        .filter(ModelRegistry.task_type == TaskType.TRANSLATION, ModelRegistry.is_default == True)
        .first()
    )
    hf_id = body.model_override or (model_row.hf_model_id if model_row else "facebook/nllb-200-distilled-600M")
    cfg = {"hf_model_id": hf_id, "config": model_row.config if model_row else {}}

    from app.worker import _run_translation
    r = _run_translation(body.text, body.src_lang, body.tgt_lang, cfg)
    return {
        "translation": r.get("translation", ""),
        "src_lang": r.get("src_lang", body.src_lang),
        "tgt_lang": r.get("tgt_lang", body.tgt_lang),
        "model": model_row.name if model_row else "nllb-200-distilled-600M (default)",
        "char_count": len(r.get("translation", "")),
        "duration": r.get("duration", 0),
    }
