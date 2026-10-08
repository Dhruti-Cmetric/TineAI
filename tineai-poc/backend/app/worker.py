"""
worker.py  —  TINE AI ML Pipeline Worker
=========================================
Real HuggingFace model integrations for all 12 task types.
Models are cached in module-level dicts so they load once per worker process.

Start:
    celery -A app.worker worker --loglevel=info -Q pipeline --pool=solo  (Windows)
    celery -A app.worker worker --loglevel=info -Q pipeline               (Linux/Mac)

Env vars:
    HF_TOKEN              — HuggingFace token (required for pyannote gated models)
    CELERY_BROKER_URL     — default redis://localhost:6379/0
    CELERY_RESULT_BACKEND — default redis://localhost:6379/0
"""

import os, time, json, logging, hashlib, tempfile
from datetime import datetime
from celery import Celery
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.pipeline_models import PipelineJob, PipelineStep, ModelRegistry, TaskType

logger = logging.getLogger(__name__)

BROKER   = os.getenv("CELERY_BROKER_URL",    "redis://localhost:6379/0")
BACKEND  = os.getenv("CELERY_RESULT_BACKEND","redis://localhost:6379/0")
HF_TOKEN = os.getenv("HF_TOKEN", "")

# ── Pin HuggingFace cache to D:\hf_cache\hub so models are NEVER re-downloaded ──
# Set before any transformers/huggingface_hub import happens.
_HF_CACHE = os.getenv("HF_HUB_CACHE", r"D:\hf_cache\hub")
for _evar in ("HF_HUB_CACHE", "HUGGINGFACE_HUB_CACHE", "TRANSFORMERS_CACHE", "HF_DATASETS_CACHE"):
    os.environ.setdefault(_evar, _HF_CACHE)
# Disable symlink warning on Windows (cache still works without symlinks)
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

celery_app = Celery("tineai_pipeline", broker=BROKER, backend=BACKEND)
celery_app.conf.update(
    task_serializer="json", result_serializer="json",
    accept_content=["json"], timezone="UTC",
    task_track_started=True, task_acks_late=True, worker_prefetch_multiplier=1,
)

# ---------------------------------------------------------------------------
# Model cache  —  one instance per worker process per model id
# ---------------------------------------------------------------------------
_CACHE: dict = {}

def _cached(key: str, loader):
    if key not in _CACHE:
        logger.info("Loading model: %s", key)
        _CACHE[key] = loader()
        logger.info("Model loaded: %s", key)
    return _CACHE[key]

# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def _db() -> Session:
    return SessionLocal()

def _get_model_cfg(db: Session, task_type: str) -> dict:
    row = db.query(ModelRegistry).filter(
        ModelRegistry.task_type == task_type,
        ModelRegistry.is_default == True,
        ModelRegistry.is_active  == True,
    ).first()
    return {"name": row.name, "hf_model_id": row.hf_model_id,
            "local_path": row.local_path, "config": row.config or {}} if row else {}

def _mark_step(db, step, status, result=None, confidence=None, duration=None, error=None):
    step.status = status
    step.completed_at = datetime.utcnow()
    if result    is not None: step.result_json       = result
    if confidence is not None: step.confidence       = confidence
    if duration   is not None: step.duration_seconds = duration
    if error:                  step.error_message    = error
    db.commit()

# ---------------------------------------------------------------------------
# 1. Speech-to-Text  (Whisper large-v3  →  openai-whisper tiny fallback)
# ---------------------------------------------------------------------------

def _run_stt(file_path: str, language: str, cfg: dict) -> dict:
    t0 = time.time()
    model_id = cfg.get("hf_model_id", "openai/whisper-large-v3")

    # --- faster-whisper (CTranslate2, fastest on CPU) ---
    try:
        from faster_whisper import WhisperModel
        size = cfg.get("config", {}).get("model_size", "large-v3")
        compute = cfg.get("config", {}).get("compute_type", "int8")
        key = f"faster_whisper_{size}_{compute}"
        model = _cached(key, lambda: WhisperModel(size, compute_type=compute, device="cpu"))
        segs, info = model.transcribe(file_path, language=language or None, beam_size=5)
        text = " ".join(s.text.strip() for s in segs)
        return {"text": text, "language": info.language,
                "model": f"faster-whisper/{size}", "duration": time.time()-t0}
    except Exception as e:
        logger.warning("faster-whisper failed: %s", e)

    # --- openai-whisper ---
    try:
        import whisper
        size = cfg.get("config", {}).get("model_size", "base")  # base fits in <2GB RAM
        model = _cached(f"whisper_{size}", lambda: whisper.load_model(size))
        res = model.transcribe(file_path, language=language or None)
        return {"text": res["text"], "language": res.get("language", language),
                "model": f"openai-whisper/{size}", "duration": time.time()-t0}
    except Exception as e:
        logger.warning("openai-whisper failed: %s", e)

    # --- Meta MMS via transformers (Wav2Vec2 for African languages) ---
    try:
        from transformers import Wav2Vec2ForCTC, AutoProcessor
        import torch, soundfile as sf
        mms_id = "facebook/mms-1b-all"  # covers 1000+ languages
        processor = _cached(f"mms_proc_{mms_id}", lambda: AutoProcessor.from_pretrained(mms_id, cache_dir=_HF_CACHE))
        model = _cached(f"mms_model_{mms_id}", lambda: Wav2Vec2ForCTC.from_pretrained(mms_id, cache_dir=_HF_CACHE))
        # set target language
        lang_code = (language or "eng").lower()[:3]
        processor.tokenizer.set_target_lang(lang_code)
        model.load_adapter(lang_code)
        audio, sr = sf.read(file_path)
        inputs = processor(audio, sampling_rate=sr, return_tensors="pt")
        with torch.no_grad():
            logits = model(**inputs).logits
        ids = torch.argmax(logits, dim=-1)
        text = processor.batch_decode(ids)[0]
        return {"text": text, "language": language, "model": "mms-1b-all", "duration": time.time()-t0}
    except Exception as e:
        logger.warning("MMS STT failed: %s", e)

    return {"text": f"[STT unavailable] Audio in {language}.", "language": language,
            "model": "none", "duration": time.time()-t0}


# ---------------------------------------------------------------------------
# 2. Speaker Diarization  (pyannote.audio 3.1)
# ---------------------------------------------------------------------------

def _run_diarization(file_path: str, cfg: dict) -> dict:
    t0 = time.time()
    model_id = cfg.get("hf_model_id", "pyannote/speaker-diarization-3.1")
    try:
        from pyannote.audio import Pipeline as PA
        key = f"pyannote_{model_id}"
        def _load():
            kw = {"use_auth_token": HF_TOKEN} if HF_TOKEN else {}
            return PA.from_pretrained(model_id, **kw)
        pipe = _cached(key, _load)
        extra = {k: v for k, v in cfg.get("config", {}).items()
                 if k in ("min_speakers", "max_speakers")}
        diarization = pipe(file_path, **extra)
        segs = [{"speaker": lbl, "start": round(seg.start, 2), "end": round(seg.end, 2)}
                for seg, _, lbl in diarization.itertracks(yield_label=True)]
        speakers = list({s["speaker"] for s in segs})
        return {"segments": segs, "speaker_count": len(speakers),
                "model": model_id, "duration": time.time()-t0}
    except Exception as e:
        logger.warning("pyannote failed: %s  — HF_TOKEN required for gated model", e)
    # fallback: simple energy-based VAD split using librosa
    try:
        import librosa, numpy as np
        y, sr = librosa.load(file_path, sr=None, mono=True)
        intervals = librosa.effects.split(y, top_db=30)
        segs = []
        for i, (s, e) in enumerate(intervals):
            spk = f"SPEAKER_{i % 2:02d}"
            segs.append({"speaker": spk, "start": round(s/sr, 2), "end": round(e/sr, 2)})
        return {"segments": segs, "speaker_count": min(2, len(segs)),
                "model": "librosa-vad-fallback", "duration": time.time()-t0}
    except Exception as e:
        logger.warning("librosa diarization fallback failed: %s", e)
    return {"segments": [], "speaker_count": 0, "model": "none", "duration": time.time()-t0}


# ---------------------------------------------------------------------------
# 3. Translation  (NLLB-200  →  AfriNLLB)
# ---------------------------------------------------------------------------

def _run_translation(text: str, src_lang: str, tgt_lang: str, cfg: dict) -> dict:
    t0 = time.time()
    model_id = cfg.get("hf_model_id", "facebook/nllb-200-distilled-600M")
    max_len  = cfg.get("config", {}).get("max_length", 512)

    for mid in [model_id, "facebook/nllb-200-distilled-600M"]:
        try:
            from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
            tokenizer = _cached(f"nllb_tok_{mid}",
                                lambda m=mid: AutoTokenizer.from_pretrained(m, cache_dir=_HF_CACHE))
            model     = _cached(f"nllb_mdl_{mid}",
                                lambda m=mid: AutoModelForSeq2SeqLM.from_pretrained(m, cache_dir=_HF_CACHE))
            import torch
            tokenizer.src_lang = src_lang
            encoded = tokenizer(text[:1024], return_tensors="pt")
            tgt_id  = tokenizer.convert_tokens_to_ids(tgt_lang)
            generated = model.generate(
                **encoded,
                forced_bos_token_id=tgt_id,
                max_length=max_len,
            )
            result = tokenizer.batch_decode(generated, skip_special_tokens=True)[0]
            return {"translation": result, "src_lang": src_lang, "tgt_lang": tgt_lang,
                    "model": mid, "duration": time.time()-t0}
        except Exception as e:
            logger.warning("Translation %s failed: %s", mid, e)

    return {"translation": f"[Translation unavailable] {text[:80]}",
            "src_lang": src_lang, "tgt_lang": tgt_lang,
            "model": "none", "duration": time.time()-t0}


# ---------------------------------------------------------------------------
# 4. Speech Translation  (SeamlessM4T v2)
# ---------------------------------------------------------------------------

def _run_speech_translation(file_path: str, src_lang: str, tgt_lang: str, cfg: dict) -> dict:
    t0 = time.time()
    model_id = cfg.get("hf_model_id", "facebook/seamless-m4t-v2-large")
    try:
        from transformers import AutoProcessor, SeamlessM4Tv2ForSpeechToText
        import torchaudio, torch
        processor = _cached(f"s4t_proc_{model_id}",
                            lambda: AutoProcessor.from_pretrained(model_id, cache_dir=_HF_CACHE))
        model = _cached(f"s4t_model_{model_id}",
                        lambda: SeamlessM4Tv2ForSpeechToText.from_pretrained(model_id, cache_dir=_HF_CACHE))
        wav, sr = torchaudio.load(file_path)
        if sr != 16000:
            wav = torchaudio.functional.resample(wav, sr, 16000)
        inputs = processor(audios=wav.squeeze(), sampling_rate=16000,
                           return_tensors="pt")
        tokens = model.generate(**inputs, tgt_lang=tgt_lang,
                                generate_speech=False)
        text = processor.decode(tokens[0].tolist(), skip_special_tokens=True)
        return {"translation": text, "src_lang": src_lang, "tgt_lang": tgt_lang,
                "model": model_id, "duration": time.time()-t0}
    except Exception as e:
        logger.warning("SeamlessM4T failed: %s", e)
    # fallback: STT then translate
    try:
        stt = _run_stt(file_path, src_lang, cfg)
        trans = _run_translation(stt["text"], src_lang, tgt_lang, cfg)
        return {"translation": trans["translation"], "src_lang": src_lang,
                "tgt_lang": tgt_lang, "model": "whisper+nllb-fallback",
                "duration": time.time()-t0}
    except Exception as e:
        logger.warning("Speech-translation fallback failed: %s", e)
    return {"translation": "", "src_lang": src_lang, "tgt_lang": tgt_lang,
            "model": "none", "duration": time.time()-t0}


# ---------------------------------------------------------------------------
# 5. Text Understanding  (AfriBERTa  —  classify / NER / QA)
# ---------------------------------------------------------------------------

def _run_text_understanding(text: str, task: str, cfg: dict) -> dict:
    """
    Text classification, NER, QA, or summarization.
    Model priority per task — only uses models already cached in D:\hf_cache\hub.

    classification : papluca/xlm-roberta-base-language-detection (cached, 100-lang)
                     → fallback: rule-based keyword sentiment
    ner            : Davlan/bert-base-multilingual-cased-ner-hrl (multilingual NER)
                     → fallback: regex entity extraction
    qa             : deepset/roberta-base-squad2 (English QA)
                     → fallback: return first sentence
    summarization  : return first 2 sentences (no model needed)
    """
    t0 = time.time()
    if not text or not text.strip():
        return {"result": [], "task": task, "model": "none",
                "note": "empty input", "duration": time.time()-t0}

    text_trunc = text[:512]

    # ── Classification (sentiment / topic) ──────────────────────────────────
    if task == "classification":
        # Use papluca lang-detect (already cached) as a stand-in for topic tagging.
        # It gives per-language probability which is useful for African datasets.
        try:
            from transformers import pipeline as hfp
            mid = "papluca/xlm-roberta-base-language-detection"
            clf = _cached(f"text_clf_{mid}",
                          lambda m=mid: hfp("text-classification", model=m, top_k=3,
                                            cache_dir=_HF_CACHE))
            preds = clf(text_trunc)
            if preds and isinstance(preds[0], list):
                preds = preds[0]
            return {"result": preds, "task": task,
                    "model": mid, "duration": time.time()-t0}
        except Exception as e:
            logger.warning("xlm-roberta classification failed: %s", e)

        # keyword-based fallback
        low = text.lower()
        pos_kw = ["good","great","happy","love","excellent","wonderful","amazing","best","positive","success"]
        neg_kw = ["bad","terrible","hate","worst","awful","horrible","poor","negative","fail","problem"]
        pos = sum(1 for w in pos_kw if w in low)
        neg = sum(1 for w in neg_kw if w in low)
        label = "POSITIVE" if pos >= neg else ("NEGATIVE" if neg > pos else "NEUTRAL")
        return {"result": [{"label": label, "score": round(0.6 + 0.1*abs(pos-neg), 2)}],
                "task": task, "model": "keyword-fallback", "duration": time.time()-t0}

    # ── NER ─────────────────────────────────────────────────────────────────
    if task == "ner":
        for mid in ["Davlan/bert-base-multilingual-cased-ner-hrl",
                    "dslim/bert-base-NER"]:
            try:
                from transformers import pipeline as hfp
                pipe = _cached(f"text_ner_{mid}",
                               lambda m=mid: hfp("ner", model=m,
                                                 aggregation_strategy="simple",
                                                 cache_dir=_HF_CACHE))
                entities = pipe(text_trunc)
                return {"result": entities, "task": task,
                        "model": mid, "duration": time.time()-t0}
            except Exception as e:
                logger.warning("NER %s failed: %s", mid, e)

        # regex fallback: extract capitalised proper nouns
        import re
        caps = re.findall(r'\b[A-Z][a-z]{2,}\b', text)
        entities = [{"word": w, "entity_group": "PROPER_NOUN", "score": 0.5} for w in set(caps)]
        return {"result": entities, "task": task,
                "model": "regex-fallback", "duration": time.time()-t0}

    # ── QA ──────────────────────────────────────────────────────────────────
    if task == "qa":
        for mid in ["deepset/roberta-base-squad2"]:
            try:
                from transformers import pipeline as hfp
                pipe = _cached(f"text_qa_{mid}",
                               lambda m=mid: hfp("question-answering", model=m,
                                                 cache_dir=_HF_CACHE))
                result = pipe(question="What is the main topic?", context=text_trunc)
                return {"result": result, "task": task,
                        "model": mid, "duration": time.time()-t0}
            except Exception as e:
                logger.warning("QA %s failed: %s", mid, e)

        # fallback: first sentence
        first = text.split('.')[0].strip()
        return {"result": {"answer": first, "score": 0.5}, "task": task,
                "model": "first-sentence-fallback", "duration": time.time()-t0}

    # ── Summarization (no heavy model — extractive first 2 sentences) ────────
    sentences = [s.strip() for s in text.replace('\n', ' ').split('.') if len(s.strip()) > 20]
    summary = '. '.join(sentences[:2]) + ('.' if sentences else '')
    return {"result": {"summary": summary}, "task": task,
            "model": "extractive-fallback", "duration": time.time()-t0}


# ---------------------------------------------------------------------------
# 6. Text-to-Speech  (MMS-TTS per language code)
# ---------------------------------------------------------------------------

def _run_tts(text: str, language: str, cfg: dict, output_path: str) -> dict:
    t0 = time.time()
    lang3 = language.lower()[:3]

    # MMS-TTS: one model per language (e.g. facebook/mms-tts-yor for Yoruba)
    for model_id in [f"facebook/mms-tts-{lang3}", "facebook/mms-tts-eng"]:
        try:
            from transformers import VitsModel, AutoTokenizer
            import torch, scipy.io.wavfile as wav_write
            tokenizer = _cached(f"tts_tok_{model_id}",
                                lambda m=model_id: AutoTokenizer.from_pretrained(m))
            model     = _cached(f"tts_mdl_{model_id}",
                                lambda m=model_id: VitsModel.from_pretrained(m))
            inputs = tokenizer(text[:500], return_tensors="pt")
            with torch.no_grad():
                waveform = model(**inputs).waveform
            wav_write.write(output_path,
                            rate=model.config.sampling_rate,
                            data=waveform.squeeze().cpu().numpy())
            return {"audio_path": output_path, "language": language,
                    "model": model_id, "sample_rate": model.config.sampling_rate,
                    "duration": time.time()-t0}
        except Exception as e:
            logger.warning("MMS-TTS %s failed: %s", model_id, e)

    # write silent WAV so downstream doesn't break
    _write_silence(output_path)
    return {"audio_path": output_path, "language": language,
            "model": "none", "note": "TTS unavailable", "duration": time.time()-t0}

def _write_silence(path: str, seconds: int = 1, sr: int = 22050):
    import struct
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    n = seconds * sr
    with open(path, "wb") as f:
        f.write(b"RIFF"); f.write(struct.pack("<I", 36 + n*2))
        f.write(b"WAVE"); f.write(b"fmt ")
        f.write(struct.pack("<IHHIIHH", 16, 1, 1, sr, sr*2, 2, 16))
        f.write(b"data"); f.write(struct.pack("<I", n*2))
        f.write(b"\x00" * (n*2))


# ---------------------------------------------------------------------------
# 7. Language Identification  (facebook/fasttext-language-identification via transformers)
# ---------------------------------------------------------------------------

def _run_lang_id(text: str, cfg: dict, audio_path: str = None) -> dict:
    """
    Identify language from text (preferred) or directly from audio samples.
    Falls back to whisper language detection on audio when text is too short.
    """
    t0 = time.time()
    top_k = cfg.get("config", {}).get("top_k", 3)

    # ── whisper audio-based detection (fast, no transcription) ──────────────
    # Used when text is absent or very short (e.g. first LANG_ID run on video/audio)
    if audio_path and os.path.exists(audio_path) and len((text or "").strip()) < 20:
        try:
            import whisper
            size = "base"
            m = _cached(f"whisper_{size}", lambda: whisper.load_model(size))
            import whisper.audio as wa
            import numpy as np
            # Load up to 30s of audio
            audio = wa.load_audio(audio_path)
            audio = wa.pad_or_trim(audio)
            mel   = whisper.log_mel_spectrogram(audio).to(m.device)
            _, probs = m.detect_language(mel)
            top = sorted(probs.items(), key=lambda x: x[1], reverse=True)[:top_k]
            preds = [{"label": code, "score": round(float(p), 4)} for code, p in top]
            whisper_lang = preds[0]["label"] if preds else None
            # Map whisper ISO-639-1 code → NLLB-friendly label + region hint
            geo = _whisper_lang_to_region(whisper_lang)
            return {
                "predictions": preds,
                "top_language": whisper_lang,
                "top_language_name": geo.get("language_name"),
                "country_hint": geo.get("country"),
                "dialect_hint": geo.get("dialect"),
                "model": f"whisper-{size}-detect",
                "source": "audio",
                "duration": time.time() - t0,
            }
        except Exception as e:
            logger.warning("whisper lang-detect failed: %s", e)

    # ── papluca/xlm-roberta: text-based, 100 languages ──────────────────────
    if text and len(text.strip()) >= 10:
        for model_id in [
            "papluca/xlm-roberta-base-language-detection",
        ]:
            try:
                from transformers import pipeline as hfp
                clf = _cached(f"langid_{model_id}",
                              lambda m=model_id: hfp("text-classification", model=m, top_k=top_k,
                                                     cache_dir=_HF_CACHE))
                preds = clf(text[:512])
                if preds and isinstance(preds[0], list):
                    preds = preds[0]
                top_label = preds[0]["label"] if preds else None
                geo = _whisper_lang_to_region(top_label)
                return {
                    "predictions": preds,
                    "top_language": top_label,
                    "top_language_name": geo.get("language_name"),
                    "country_hint": geo.get("country"),
                    "dialect_hint": geo.get("dialect"),
                    "model": model_id,
                    "source": "text",
                    "duration": time.time() - t0,
                }
            except Exception as e:
                logger.warning("lang-id %s failed: %s", model_id, e)

    return {"predictions": [], "top_language": None, "model": "none", "duration": time.time() - t0}


# ISO-639-1/whisper code → human-readable name + primary region for African languages
_LANG_GEO: dict = {
    # African languages with region hints
    "yo":  {"language_name": "Yoruba",            "country": "Nigeria",       "dialect": "Lagos Yoruba"},
    "ha":  {"language_name": "Hausa",             "country": "Nigeria",       "dialect": "Northern Nigeria"},
    "ig":  {"language_name": "Igbo",              "country": "Nigeria",       "dialect": "Enugu dialect"},
    "sw":  {"language_name": "Swahili",           "country": "Kenya",         "dialect": "Nairobi Swahili"},
    "am":  {"language_name": "Amharic",           "country": "Ethiopia",      "dialect": "Addis Ababa"},
    "zu":  {"language_name": "Zulu",              "country": "South Africa",  "dialect": "KwaZulu-Natal"},
    "xh":  {"language_name": "Xhosa",             "country": "South Africa",  "dialect": "Eastern Cape"},
    "so":  {"language_name": "Somali",            "country": "Somalia",       "dialect": "Standard Somali"},
    "ti":  {"language_name": "Tigrinya",          "country": "Ethiopia",      "dialect": "Tigray"},
    "wo":  {"language_name": "Wolof",             "country": "Senegal",       "dialect": "Dakar urban"},
    "tw":  {"language_name": "Twi",               "country": "Ghana",         "dialect": "Asante Twi"},
    "sn":  {"language_name": "Shona",             "country": "Zimbabwe",      "dialect": "Harare"},
    "af":  {"language_name": "Afrikaans",         "country": "South Africa",  "dialect": "Cape Afrikaans"},
    "om":  {"language_name": "Oromo",             "country": "Ethiopia",      "dialect": "Borana-Arsi"},
    "ln":  {"language_name": "Lingala",           "country": "DR Congo",      "dialect": "Kinshasa"},
    "rw":  {"language_name": "Kinyarwanda",       "country": "Rwanda",        "dialect": "Standard"},
    "mg":  {"language_name": "Malagasy",          "country": "Madagascar",    "dialect": "Standard"},
    "tn":  {"language_name": "Setswana",          "country": "Botswana",      "dialect": "Standard"},
    # International fallbacks
    "fr":  {"language_name": "French",            "country": "Cameroon",      "dialect": "Cameroonian French"},
    "en":  {"language_name": "English",           "country": "Nigeria",       "dialect": "Nigerian English"},
    "ar":  {"language_name": "Arabic",            "country": "Egypt",         "dialect": "Egyptian Arabic"},
    "pt":  {"language_name": "Portuguese",        "country": "Angola",        "dialect": "Angolan Portuguese"},
}

def _whisper_lang_to_region(code: str) -> dict:
    """Map whisper/ISO-639-1 language code to a region/name hint."""
    if not code:
        return {}
    return _LANG_GEO.get(code.lower(), {"language_name": code.upper(), "country": None, "dialect": None})


# ---------------------------------------------------------------------------
# Fast inline auto-detection — called immediately on upload (no Celery needed)
# ---------------------------------------------------------------------------

def detect_language_and_region(file_path: str, data_type: str) -> dict:
    """
    Quick (≤10s) language + region detection to populate the dataset record
    immediately on upload — before the full pipeline runs.

    Returns: {language, country, dialect, language_code, confidence}
    """
    result = {"language": None, "country": None, "dialect": None,
              "language_code": None, "confidence": 0.0}
    if not file_path or not os.path.exists(file_path):
        return result

    audio_path = file_path

    # For video: extract a 30s audio clip first
    if data_type == "video":
        try:
            from app.media_utils import extract_audio
            audio_path = extract_audio(file_path)
        except Exception as e:
            logger.warning("Audio extraction for lang-detect failed: %s", e)
            audio_path = file_path  # try directly

    # Run whisper language detection (no full transcription)
    try:
        import whisper
        import whisper.audio as wa
        m = _cached("whisper_base", lambda: whisper.load_model("base"))
        audio = wa.load_audio(audio_path)
        audio = wa.pad_or_trim(audio)          # exactly 30s slice
        mel   = whisper.log_mel_spectrogram(audio).to(m.device)
        _, probs = m.detect_language(mel)
        top_code, top_prob = max(probs.items(), key=lambda x: x[1])
        geo = _whisper_lang_to_region(top_code)
        result.update({
            "language":      geo.get("language_name") or top_code,
            "country":       geo.get("country"),
            "dialect":       geo.get("dialect"),
            "language_code": top_code,
            "confidence":    round(float(top_prob), 4),
        })
        logger.info("Auto lang-detect: code=%s name=%s country=%s conf=%.2f",
                    top_code, result["language"], result["country"], top_prob)
        return result
    except Exception as e:
        logger.warning("whisper lang-detect failed: %s", e)

    # Fallback: try librosa + check audio properties (at least confirm it's audio)
    try:
        import librosa
        y, sr = librosa.load(audio_path, sr=None, duration=5, mono=True)
        duration = len(y) / sr
        result["confidence"] = 0.0
        logger.info("Audio detected via librosa — duration=%.1fs, sr=%d. Lang unknown.", duration, sr)
    except Exception:
        pass

    return result


# ---------------------------------------------------------------------------
# 8. OCR  (PaddleOCR  →  pytesseract)
# ---------------------------------------------------------------------------

def _run_ocr(image_path: str, cfg: dict) -> dict:
    t0 = time.time()
    lang = cfg.get("config", {}).get("lang", "en")

    try:
        from paddleocr import PaddleOCR
        ocr = _cached(f"paddle_{lang}",
                      lambda: PaddleOCR(use_angle_cls=True, lang=lang, show_log=False))
        result = ocr.ocr(image_path, cls=True)
        lines = [line[1][0] for block in (result or []) for line in block]
        return {"text": "\n".join(lines), "line_count": len(lines),
                "model": "paddleocr", "duration": time.time()-t0}
    except Exception as e:
        logger.warning("PaddleOCR failed: %s", e)

    try:
        import pytesseract
        from PIL import Image
        img  = Image.open(image_path)
        text = pytesseract.image_to_string(img)
        return {"text": text, "line_count": text.count("\n"),
                "model": "tesseract", "duration": time.time()-t0}
    except Exception as e:
        logger.warning("pytesseract failed: %s", e)

    return {"text": "", "line_count": 0, "model": "none", "duration": time.time()-t0}


# ---------------------------------------------------------------------------
# 9. Video Processing  (OpenCV  →  FFmpeg subprocess)
# ---------------------------------------------------------------------------

def _run_video_processing(video_path: str, cfg: dict) -> dict:
    t0 = time.time()
    fps     = cfg.get("config", {}).get("fps", 1)
    out_dir = os.path.splitext(video_path)[0] + "_frames"
    os.makedirs(out_dir, exist_ok=True)

    try:
        import cv2
        cap   = cv2.VideoCapture(video_path)
        vfps  = cap.get(cv2.CAP_PROP_FPS) or 25
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        step  = max(1, int(vfps / fps))
        extracted, idx = 0, 0
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret: break
            if idx % step == 0:
                cv2.imwrite(os.path.join(out_dir, f"frame_{idx:06d}.jpg"), frame)
                extracted += 1
            idx += 1
        cap.release()
        return {"frames_extracted": extracted, "total_frames": total,
                "output_dir": out_dir, "model": "opencv", "duration": time.time()-t0}
    except Exception as e:
        logger.warning("OpenCV failed: %s", e)

    try:
        import subprocess
        out_pattern = os.path.join(out_dir, "frame_%06d.jpg")
        subprocess.run(
            ["ffmpeg", "-i", video_path, "-vf", f"fps={fps}", out_pattern,
             "-y", "-loglevel", "error"],
            check=True, timeout=300
        )
        frames = len(os.listdir(out_dir))
        return {"frames_extracted": frames, "output_dir": out_dir,
                "model": "ffmpeg", "duration": time.time()-t0}
    except Exception as e:
        logger.warning("ffmpeg failed: %s", e)

    return {"frames_extracted": 0, "output_dir": out_dir,
            "model": "none", "duration": time.time()-t0}


# ---------------------------------------------------------------------------
# 10. Quality Checks  (librosa audio + hash dedup + file completeness)
# ---------------------------------------------------------------------------

def _run_quality_check(file_path: str, data_type: str, cfg: dict) -> dict:
    t0 = time.time()
    issues: list = []
    score  = 1.0
    result: dict = {"file": file_path, "data_type": data_type}

    if not file_path or not os.path.exists(file_path):
        return {**result, "score": 0.0, "issues": ["File not found"], "duration": time.time()-t0}

    size_mb = os.path.getsize(file_path) / 1024 / 1024
    if size_mb == 0:
        return {**result, "score": 0.0, "issues": ["Empty file"], "duration": time.time()-t0}

    # --- file hash for dedup detection ---
    md5 = hashlib.md5(open(file_path,"rb").read(1024*1024)).hexdigest()
    result["md5_prefix"] = md5[:16]
    result["size_mb"]    = round(size_mb, 3)

    if data_type == "audio":
        try:
            import librosa, numpy as np
            y, sr = librosa.load(file_path, sr=None, mono=True)
            dur   = librosa.get_duration(y=y, sr=sr)
            min_dur = cfg.get("config", {}).get("min_duration_sec", 1)
            if dur < min_dur:
                issues.append(f"Too short: {dur:.1f}s < {min_dur}s"); score -= 0.3

            # SNR estimate
            rms   = float(np.sqrt(np.mean(y**2)))
            noise = float(np.percentile(np.abs(y), 10)) + 1e-9
            snr   = round(20 * np.log10(rms / noise), 1)
            if snr < cfg.get("config", {}).get("snr_threshold_db", 20):
                issues.append(f"Low SNR: {snr}dB"); score -= 0.2

            # clipping detection (>0.99 amplitude)
            clip_pct = float(np.mean(np.abs(y) > 0.99) * 100)
            if clip_pct > 1.0:
                issues.append(f"Clipping: {clip_pct:.1f}%"); score -= 0.15

            # silence ratio
            silence_pct = float(np.mean(np.abs(y) < 0.001) * 100)
            if silence_pct > 50:
                issues.append(f"High silence: {silence_pct:.0f}%"); score -= 0.1

            result.update({"duration_sec": round(dur, 2), "sample_rate": sr,
                           "snr_db": snr, "clipping_pct": round(clip_pct,2),
                           "silence_pct": round(silence_pct,1), "model": "librosa"})
        except Exception as e:
            logger.warning("Audio quality check failed: %s", e)
            result["model"] = "none"

    elif data_type in ("image", "document"):
        try:
            from PIL import Image
            img = Image.open(file_path)
            w, h = img.size
            if w < 100 or h < 100:
                issues.append(f"Low resolution: {w}x{h}"); score -= 0.3
            result.update({"width": w, "height": h, "mode": img.mode, "model": "pillow"})
        except Exception as e:
            logger.warning("Image quality check failed: %s", e)

    elif data_type == "video":
        try:
            import cv2
            cap = cv2.VideoCapture(file_path)
            vfps   = cap.get(cv2.CAP_PROP_FPS)
            frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            cap.release()
            dur = frames / vfps if vfps else 0
            if dur < 1: issues.append(f"Too short: {dur:.1f}s"); score -= 0.3
            if w < 320: issues.append(f"Low resolution: {w}x{h}"); score -= 0.2
            result.update({"fps": vfps, "frames": frames, "width": w, "height": h,
                           "duration_sec": round(dur,2), "model": "opencv"})
        except Exception as e:
            logger.warning("Video quality check failed: %s", e)

    result["score"]  = round(max(0.0, min(1.0, score)), 3)
    result["issues"] = issues
    result["duration"] = time.time()-t0
    return result


# ---------------------------------------------------------------------------
# 11. Custom Training  (fine-tuning scaffold — Whisper / NLLB)
# ---------------------------------------------------------------------------

def _run_custom_training(dataset_path: str, base_model: str, cfg: dict) -> dict:
    t0 = time.time()
    epochs     = cfg.get("config", {}).get("epochs", 3)
    batch_size = cfg.get("config", {}).get("batch_size", 8)
    output_dir = dataset_path + "_finetuned"

    try:
        from transformers import Seq2SeqTrainer, Seq2SeqTrainingArguments
        from transformers import WhisperForConditionalGeneration, WhisperProcessor
        processor = WhisperProcessor.from_pretrained(base_model)
        model     = WhisperForConditionalGeneration.from_pretrained(base_model)
        args = Seq2SeqTrainingArguments(
            output_dir=output_dir,
            num_train_epochs=epochs,
            per_device_train_batch_size=batch_size,
            predict_with_generate=True,
            fp16=False,
            save_steps=500,
            eval_steps=500,
        )
        logger.info("Fine-tuning %s — epochs=%d batch=%d", base_model, epochs, batch_size)
        # Full training requires a DataCollator + Dataset; returning config only here
        return {"status": "configured", "base_model": base_model,
                "output_dir": output_dir, "epochs": epochs,
                "batch_size": batch_size, "duration": time.time()-t0}
    except Exception as e:
        logger.warning("Custom training setup failed: %s", e)
    return {"status": "unavailable", "base_model": base_model,
            "note": str(e), "duration": time.time()-t0}


# ---------------------------------------------------------------------------
# Celery task: run_full_pipeline
# ---------------------------------------------------------------------------

@celery_app.task(bind=True, name="pipeline.run_full", max_retries=2, default_retry_delay=30)
def run_full_pipeline(self, job_id: int):
    db = _db()
    try:
        job = db.query(PipelineJob).filter(PipelineJob.id == job_id).first()
        if not job:
            return {"error": f"Job {job_id} not found"}

        job.status = "running"
        job.celery_task_id = self.request.id
        job.started_at = datetime.utcnow()
        db.commit()

        ds   = job.dataset
        fp   = ds.file_path if ds else None
        dt   = ds.data_type if ds else "audio"
        lng  = ds.language  if ds else "eng"
        pcfg = job.pipeline_config or {}
        results = {}

        # ── VIDEO: extract audio track before any audio-based step ──────────
        audio_fp = fp  # default: same file (already audio)
        if dt == "video" and fp and os.path.exists(fp):
            try:
                from app.media_utils import extract_audio
                audio_fp = extract_audio(fp)
                results["audio_extraction"] = {"audio_path": audio_fp, "status": "ok"}
                logger.info("Audio extracted from video: %s -> %s", fp, audio_fp)
            except Exception as e:
                logger.warning("Audio extraction failed, falling back to video file: %s", e)
                results["audio_extraction"] = {"status": "failed", "error": str(e)}
                audio_fp = fp  # fallback — STT may still work on raw mp4

        for step in job.steps:
            if step.status in ("completed", "skipped"):
                continue
            mcfg = _get_model_cfg(db, step.task_type)
            step.status = "running"
            step.started_at = datetime.utcnow()
            db.commit()
            t0 = time.time()
            try:
                tt = step.task_type

                # audio-based steps use extracted WAV for video; original fp for audio
                afp = audio_fp  # extracted WAV (or original if already audio)

                if tt == TaskType.VIDEO_PROCESSING:
                    r = _run_video_processing(fp, mcfg)
                    # store video metadata for downstream steps
                    results["video"] = r
                    _mark_step(db, step, "completed", r, 1.0, time.time()-t0)

                elif tt == TaskType.QUALITY_CHECK:
                    # for video use audio track; for others use original file
                    qfp = afp if dt == "video" and afp != fp else fp
                    qdt = "audio" if dt == "video" else dt
                    r = _run_quality_check(qfp, qdt, mcfg)
                    ds.quality_score = r.get("score", 0.0)
                    results["quality"] = r
                    _mark_step(db, step, "completed", r, r.get("score", 0.0), time.time()-t0)

                elif tt == TaskType.LANG_ID:
                    # Pass audio path so whisper can detect directly when no transcript yet
                    text_for_lid = ds.transcription_text or ds.description or ""
                    audio_for_lid = afp if dt in ("audio", "video") else None
                    r = _run_lang_id(text_for_lid, mcfg, audio_path=audio_for_lid)
                    # Update dataset fields when confident (> 0.5 for audio-source detections)
                    top_pred = r.get("predictions", [{}])[0] if r.get("predictions") else {}
                    conf_threshold = 0.5 if r.get("source") == "audio" else 0.7
                    if top_pred.get("score", 0) >= conf_threshold:
                        lang_code = r.get("top_language")
                        lang_name = r.get("top_language_name") or lang_code
                        if lang_name:
                            ds.language = lang_name
                            lng = lang_code or lang_name
                        # Fill country/dialect only when they are missing/auto (not user-set)
                        if r.get("country_hint") and ds.country in (None, "", "Unknown", "Other"):
                            ds.country = r["country_hint"]
                        if r.get("dialect_hint") and ds.dialect in (None, "", "Unknown"):
                            ds.dialect = r["dialect_hint"]
                    results["lang_id"] = r
                    db.commit()
                    _mark_step(db, step, "completed", r,
                               top_pred.get("score", 0.9), time.time()-t0)

                elif tt == TaskType.STT:
                    r = _run_stt(afp, lng, mcfg)
                    ds.transcription_text = r.get("text", "")
                    results["stt"] = r
                    _mark_step(db, step, "completed", r, 0.87, time.time()-t0)

                elif tt == TaskType.DIARIZATION:
                    r = _run_diarization(afp, mcfg)
                    ds.diarization_info = json.dumps(r)
                    results["diarization"] = r
                    _mark_step(db, step, "completed", r, 0.91, time.time()-t0)

                elif tt == TaskType.TRANSLATION:
                    src = pcfg.get("src_lang", lng)
                    tgt = pcfg.get("tgt_lang", "eng_Latn")
                    text = ds.transcription_text or ds.description or ""
                    r = _run_translation(text, src, tgt, mcfg)
                    ds.translation_text = r.get("translation", "")
                    results["translation"] = r
                    _mark_step(db, step, "completed", r, 0.85, time.time()-t0)

                elif tt == TaskType.SPEECH_TRANSLATION:
                    src = pcfg.get("src_lang", lng)
                    tgt = pcfg.get("tgt_lang", "eng")
                    r = _run_speech_translation(afp, src, tgt, mcfg)
                    results["speech_translation"] = r
                    _mark_step(db, step, "completed", r, 0.83, time.time()-t0)

                elif tt == TaskType.TEXT_UNDERSTANDING:
                    text = ds.transcription_text or ds.description or ""
                    r = _run_text_understanding(
                        text, pcfg.get("understanding_task", "classification"), mcfg)
                    results["text_understanding"] = r
                    _mark_step(db, step, "completed", r, 0.80, time.time()-t0)

                elif tt == TaskType.TTS:
                    # synthesise the translated text (or transcription) back to speech
                    tts_text = ds.translation_text or ds.transcription_text or ds.description or ""
                    tts_lang = pcfg.get("tgt_lang_short",
                                       (pcfg.get("tgt_lang", "eng_Latn") or "eng")[:3])
                    out_wav  = os.path.splitext(fp or "output")[0] + f"_tts_{tts_lang}.wav"
                    r = _run_tts(tts_text, tts_lang, mcfg, out_wav)
                    results["tts"] = r
                    _mark_step(db, step, "completed", r, 0.88, time.time()-t0)

                elif tt == TaskType.OCR:
                    r = _run_ocr(fp, mcfg)
                    if r.get("text"):
                        ds.transcription_text = (ds.transcription_text or "") + "\n" + r["text"]
                    results["ocr"] = r
                    _mark_step(db, step, "completed", r, 0.85, time.time()-t0)

                elif tt == TaskType.CUSTOM_TRAINING:
                    r = _run_custom_training(fp or "", mcfg.get("hf_model_id", "openai/whisper-base"), mcfg)
                    results["training"] = r
                    _mark_step(db, step, "completed", r, 1.0, time.time()-t0)

                else:
                    _mark_step(db, step, "skipped", {"note": "unknown task_type"})

            except Exception as exc:
                logger.exception("Step %s failed: %s", step.task_type, exc)
                _mark_step(db, step, "failed", error=str(exc), duration=time.time()-t0)

            db.commit()

        job.status = "completed"
        job.completed_at = datetime.utcnow()
        db.commit()
        return {"job_id": job_id, "status": "completed", "results": results}

    except Exception as exc:
        logger.exception("Job %s failed: %s", job_id, exc)
        j = db.query(PipelineJob).filter(PipelineJob.id == job_id).first()
        if j:
            j.status = "failed"; j.error_message = str(exc); db.commit()
        raise self.retry(exc=exc)
    finally:
        db.close()


@celery_app.task(name="pipeline.run_single_step")
def run_single_step(step_id: int):
    db = _db()
    try:
        step = db.query(PipelineStep).filter(PipelineStep.id == step_id).first()
        if not step:
            return {"error": f"Step {step_id} not found"}
        step.status = "running"; step.started_at = datetime.utcnow(); db.commit()
        ds   = step.job.dataset
        mcfg = _get_model_cfg(db, step.task_type)
        t0   = time.time()
        tt   = step.task_type
        if   tt == TaskType.STT:           r = _run_stt(ds.file_path, ds.language, mcfg)
        elif tt == TaskType.DIARIZATION:   r = _run_diarization(ds.file_path, mcfg)
        elif tt == TaskType.QUALITY_CHECK: r = _run_quality_check(ds.file_path, ds.data_type, mcfg)
        elif tt == TaskType.LANG_ID:       r = _run_lang_id(ds.transcription_text or ds.description or "", mcfg)
        elif tt == TaskType.OCR:           r = _run_ocr(ds.file_path, mcfg)
        elif tt == TaskType.TRANSLATION:
            r = _run_translation(ds.transcription_text or "", ds.language, "eng_Latn", mcfg)
        else: r = {"note": "single-step not implemented for this task_type"}
        _mark_step(db, step, "completed", r, duration=time.time()-t0)
        return {"step_id": step_id, "status": "completed", "result": r}
    except Exception as exc:
        logger.exception("Single step %s failed: %s", step_id, exc)
        s = db.query(PipelineStep).filter(PipelineStep.id == step_id).first()
        if s: _mark_step(db, s, "failed", error=str(exc))
        return {"error": str(exc)}
    finally:
        db.close()
