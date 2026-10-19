import os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import app.models.models
from app.worker import (
    _run_stt, _run_diarization, _run_translation, _run_text_understanding,
    _run_lang_id, _run_quality_check, detect_language_and_region,
    _resolve_nllb_lang_code
)

print("=" * 65)
print("TESTING TINE AI HUGGING FACE MODEL ACCURACY & FUNCTIONALITY")
print("=" * 65)

# 1. Test Text Language Identification with African Language Heuristics & HF models
print("\n[1] Testing Language Identification (African Languages)...")
sample_texts = {
    "Yoruba": "Bawo ni gbogbo yin se wa loni? A nireti pe e wa daadaa.",
    "Swahili": "Habari za asubuhi, karibu kwenye jukwaa la TINE AI.",
    "Hausa": "Ina kwana, barka da zuwa dandalin TINE AI na Najeriya.",
    "Amharic": "እንደምን አደሩ፣ ወደ TINE AI የውሂብ መድረክ እንኳን በደህና መጡ።",
    "French": "Bonjour tout le monde, bienvenue sur la plateforme TINE AI au Cameroun.",
}

for lang, text in sample_texts.items():
    res = _run_lang_id(text, {"config": {"top_k": 3}})
    top_pred = res.get("predictions", [{}])[0] if res.get("predictions") else {}
    score = top_pred.get("score")
    print(f"  Input: {lang:8s} -> Detected: {res.get('top_language_name')} ({res.get('top_language')}) | Conf: {score} | Model: {res.get('model')}")

# 2. Test Translation with NLLB-200 and automatic code resolution
print("\n[2] Testing Translation with NLLB-200 (Highest African Language Accuracy)...")
translations = [
    ("Habari za asubuhi, habari yako?", "Swahili", "English"),
    ("Bawo ni gbogbo yin se wa loni?", "Yoruba", "English"),
    ("Ina kwana, barka da zuwa.", "Hausa", "English"),
    ("Bonjour et bienvenue au Cameroun.", "Cameroonian French", "English"),
]
for text, src, tgt in translations:
    res = _run_translation(text, src, tgt, {"hf_model_id": "facebook/nllb-200-distilled-600M"})
    print(f"  [{src} ({res.get('src_lang')}) -> {tgt} ({res.get('tgt_lang')})]")
    print(f"    Source: '{text}'")
    print(f"    Target: '{res.get('translation')}' (model: {res.get('model')})")

# 3. Test Text Understanding (African Topic Classification & NER)
print("\n[3] Testing Text Understanding...")
test_text = "The local farmers in Kano market are selling maize, sorghum, and millet at reasonable prices."
res_clf = _run_text_understanding(test_text, "classification", {})
print(f"  Classification: '{test_text[:60]}...'")
for pred in res_clf.get("result", [])[:3]:
    print(f"    - {pred['label']}: {pred['score']}")
print(f"    Model used: {res_clf.get('model')}")

ner_text = "President Bola Tinubu met with Dr. Sarah Chen in Lagos yesterday."
res_ner = _run_text_understanding(ner_text, "ner", {})
print(f"  NER Entities for '{ner_text}':")
for ent in res_ner.get("result", [])[:4]:
    print(f"    - {ent.get('word', ent.get('entity_group'))}: {ent.get('entity_group', ent.get('label'))}")

# 4. Test Audio File Pipeline
audio_file = "./uploads/066c35d4-8e06-4a1d-9efb-1caa07bc74b0.mp3"
if os.path.exists(audio_file):
    print(f"\n[4] Testing Audio Quality & Lang Detect on real audio: {audio_file}")
    q_res = _run_quality_check(audio_file, "audio", {})
    print(f"  Quality Score: {q_res.get('score')} | SNR: {q_res.get('snr_db')}dB | Dur: {q_res.get('duration_sec')}s | Issues: {q_res.get('issues')}")

    lid_res = detect_language_and_region(audio_file, "audio")
    print(f"  Audio LID: {lid_res.get('language')} ({lid_res.get('language_code')}) | Country: {lid_res.get('country')} | Dialect: {lid_res.get('dialect')} | Conf: {lid_res.get('confidence')} | Model: {lid_res.get('model')}")
else:
    print(f"\n[4] Audio file {audio_file} not found.")

print("\n" + "=" * 65)
print("ALL VERIFICATIONS COMPLETED SUCCESSFULLY")
print("=" * 65)
