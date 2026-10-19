"""
pipeline_config.py — default model assignments per task type.

Optimised for CPU / fast startup — uses smallest models already cached.
Swap any entry via POST /api/models/{id}/set-default at runtime.
"""

PIPELINE_DEFAULTS = {
    # whisper-large-v3: already cached at D:\hf_cache\hub — best African language accuracy
    "speech_to_text": {
        "name": "whisper-large-v3",
        "hf_model_id": "openai/whisper-large-v3",
        "provider": "openai",
        "language_support": "all",
        "config": {"model_size": "large-v3", "compute_type": "int8"},
    },
    # community-1 is non-gated (no HF_TOKEN required); falls back to librosa VAD
    "diarization": {
        "name": "pyannote-speaker-diarization",
        "hf_model_id": "pyannote/speaker-diarization-community-1",
        "provider": "pyannote",
        "language_support": "all",
        "config": {"min_speakers": 1, "max_speakers": 6},
    },
    # nllb-200-distilled-600M: already cached, ~2.4GB but tokenizer/model loads once
    "translation": {
        "name": "nllb-200-distilled-600M",
        "hf_model_id": "facebook/nllb-200-distilled-600M",
        "provider": "meta",
        "language_support": "all",
        "config": {"max_length": 256},
    },
    # speech translation: use whisper+nllb fallback (SeamlessM4T-large too big for CPU)
    "speech_translation": {
        "name": "whisper-base+nllb-fallback",
        "hf_model_id": "facebook/seamless-m4t-v2-large",
        "provider": "meta",
        "language_support": "all",
        "config": {"model_size": "base"},
    },
    # castorini/afriberta_large: pretrained African language model for text classification & understanding
    "text_understanding": {
        "name": "afriberta-large",
        "hf_model_id": "castorini/afriberta_large",
        "provider": "castorini",
        "language_support": "all",
        "config": {},
    },
    # mms-tts per language: ~10MB each, already cached for yor/eng
    "text_to_speech": {
        "name": "mms-tts",
        "hf_model_id": "facebook/mms-tts",
        "provider": "meta",
        "language_support": "all",
        "config": {},
    },
    # papluca: ~280MB, already cached, 100-language detection
    "language_identification": {
        "name": "xlm-roberta-lang-detect",
        "hf_model_id": "papluca/xlm-roberta-base-language-detection",
        "provider": "papluca",
        "language_support": "all",
        "config": {"top_k": 3},
    },
    "ocr": {
        "name": "tesseract",
        "hf_model_id": None,
        "provider": "tesseract",
        "language_support": "all",
        "config": {"lang": "eng"},
    },
    "image_annotation": {
        "name": "cvat-auto",
        "hf_model_id": None,
        "provider": "cvat",
        "language_support": "all",
        "config": {},
    },
    "video_processing": {
        "name": "opencv",
        "hf_model_id": None,
        "provider": "local",
        "language_support": "all",
        "config": {"fps": 1},
    },
    "quality_check": {
        "name": "librosa-quality",
        "hf_model_id": None,
        "provider": "tineai",
        "language_support": "all",
        "config": {"snr_threshold_db": 20, "min_duration_sec": 1},
    },
    "custom_training": {
        "name": "whisper-base-finetune",
        "hf_model_id": "openai/whisper-base",
        "provider": "openai",
        "language_support": "all",
        "config": {"epochs": 3, "batch_size": 4},
    },
}
