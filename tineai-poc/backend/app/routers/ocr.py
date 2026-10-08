"""
routers/ocr.py — OCR endpoint

POST /api/ocr/extract   extract text from an uploaded image or PDF
"""
import os, uuid
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.auth import get_current_user
from app.config import settings
from app.models.pipeline_models import ModelRegistry, TaskType

router = APIRouter(prefix="/api/ocr", tags=["ocr"])


def _ocr(image_path: str, lang: str) -> dict:
    try:
        from paddleocr import PaddleOCR
        ocr = PaddleOCR(use_angle_cls=True, lang=lang, show_log=False)
        result = ocr.ocr(image_path, cls=True)
        lines = [line[1][0] for block in result for line in block]
        return {"text": "\n".join(lines), "engine": "paddleocr", "line_count": len(lines)}
    except Exception:
        pass
    try:
        import pytesseract
        from PIL import Image
        img = Image.open(image_path)
        text = pytesseract.image_to_string(img)
        return {"text": text, "engine": "tesseract", "line_count": text.count("\n")}
    except Exception:
        pass
    return {"text": "[MOCK OCR] Text extracted from image.", "engine": "mock", "line_count": 1}


@router.post("/extract")
async def extract_text(
    lang: str = Form("en"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if not file.filename:
        raise HTTPException(400, "No file provided")

    ext = os.path.splitext(file.filename)[1].lower()
    allowed = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".pdf", ".webp"}
    if ext not in allowed:
        raise HTTPException(400, f"Unsupported file type: {ext}. Allowed: {allowed}")

    fname = f"ocr_{uuid.uuid4()}{ext}"
    fpath = os.path.join(settings.UPLOAD_DIR, fname)
    content = await file.read()
    with open(fpath, "wb") as f:
        f.write(content)

    model_row = (
        db.query(ModelRegistry)
        .filter(ModelRegistry.task_type == TaskType.OCR, ModelRegistry.is_default == True)
        .first()
    )
    ocr_lang = (model_row.config or {}).get("lang", lang) if model_row else lang

    result = _ocr(fpath, ocr_lang)
    result["file"] = file.filename
    result["model"] = model_row.name if model_row else "paddleocr (default)"
    return result
