import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import app.models.models
from app.worker import _run_quality_check, detect_language_and_region, _run_stt, _run_diarization

audio_file = "./uploads/066c35d4-8e06-4a1d-9efb-1caa07bc74b0.mp3"
print(f"File exists: {os.path.exists(audio_file)}")

print("\n--- 1. Quality Check ---")
q = _run_quality_check(audio_file, "audio", {})
print("Quality:", q)

print("\n--- 2. Detect Language & Region ---")
l = detect_language_and_region(audio_file, "audio")
print("Lang Detect:", l)

print("\n--- 3. Speech-to-Text ---")
stt = _run_stt(audio_file, l.get("language_code") or "ha", {"config": {"compute_type": "int8", "model_size": "large-v3"}})
print("STT Model:", stt.get("model"))
print("STT Duration:", stt.get("duration"))
print("STT Text:", stt.get("text")[:200])

print("\n--- 4. Diarization ---")
diar = _run_diarization(audio_file, {})
print("Diar Model:", diar.get("model"))
print("Speakers:", diar.get("speaker_count"))
print("Segments count:", len(diar.get("segments", [])))
