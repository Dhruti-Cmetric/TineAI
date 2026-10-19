"""
routers/tts.py — Text-to-Speech endpoint

POST /api/tts/synthesize    generate speech from text
GET  /api/tts/languages     list supported TTS languages
"""
import os, uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.auth import get_current_user
from app.config import settings
from app.models.pipeline_models import ModelRegistry, TaskType

router = APIRouter(prefix="/api/tts", tags=["tts"])

MMS_TTS_LANGS = [
    "yor", "hau", "ibo", "swa", "amh", "zul", "wol", "som",
    "orm", "kin", "nya", "lin", "lug", "tir", "xho", "afr",
    "eng", "fra", "por",
]


class TTSRequest(BaseModel):
    model_config = {"protected_namespaces": ()}

    text: str
    language: str = "eng"        # 3-letter ISO code
    model_override: Optional[str] = None


def _synthesize(text: str, language: str, hf_model_id: str, output_path: str) -> bool:
    try:
        from transformers import VitsModel, AutoTokenizer
        import torch, scipy.io.wavfile as wav
        model_id = hf_model_id or f"facebook/mms-tts-{language.lower()[:3]}"
        tokenizer = AutoTokenizer.from_pretrained(model_id)
        model = VitsModel.from_pretrained(model_id)
        inputs = tokenizer(text, return_tensors="pt")
        with torch.no_grad():
            output = model(**inputs).waveform
        wav.write(output_path, rate=model.config.sampling_rate, data=output.squeeze().numpy())
        return True
    except Exception:
        # Write a silent WAV header as mock so the response still returns a file
        try:
            import struct
            duration_samples = 22050  # 1 second silence at 22050 Hz
            with open(output_path, "wb") as f:
                data_size = duration_samples * 2
                f.write(b"RIFF")
                f.write(struct.pack("<I", 36 + data_size))
                f.write(b"WAVE")
                f.write(b"fmt ")
                f.write(struct.pack("<IHHIIHH", 16, 1, 1, 22050, 44100, 2, 16))
                f.write(b"data")
                f.write(struct.pack("<I", data_size))
                f.write(b"\x00" * data_size)
        except Exception:
            pass
        return False


@router.get("/languages")
def supported_tts_languages():
    return {"languages": MMS_TTS_LANGS, "count": len(MMS_TTS_LANGS)}


@router.post("/synthesize")
def synthesize(
    body: TTSRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if not body.text.strip():
        raise HTTPException(400, "text is empty")
    if len(body.text) > 5000:
        raise HTTPException(400, "text exceeds 5000 characters")

    model_row = (
        db.query(ModelRegistry)
        .filter(ModelRegistry.task_type == TaskType.TTS, ModelRegistry.is_default == True)
        .first()
    )
    hf_id = body.model_override or (model_row.hf_model_id if model_row else None)

    out_name = f"tts_{uuid.uuid4()}.wav"
    out_path = os.path.join(settings.UPLOAD_DIR, out_name)

    real = _synthesize(body.text, body.language, hf_id, out_path)

    return FileResponse(
        path=out_path,
        media_type="audio/wav",
        filename=out_name,
        headers={
            "X-TTS-Language": body.language,
            "X-TTS-Model": model_row.name if model_row else "mms-tts (default)",
            "X-TTS-Mock": str(not real),
        },
    )
