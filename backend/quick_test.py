import sys, time, os
sys.path.insert(0, '.')

print("Testing cached models (fast path only)...")

# 1. Language ID - papluca already cached
t = time.time()
from app.worker import _run_lang_id
r = _run_lang_id('Habari za asubuhi. Nimefurahi kukutana nawe.', {'config': {'top_k': 3}})
print(f"[1] LangID : top={r.get('top_language')} model={r.get('model')} ({time.time()-t:.1f}s)")

# 2. Quality check - opencv, no download
t = time.time()
from app.worker import _run_quality_check
uploads = './uploads'
mp4 = next((f for f in os.listdir(uploads) if f.endswith('.mp4')), None)
r = _run_quality_check(os.path.join(uploads, mp4) if mp4 else '', 'video', {})
print(f"[2] Quality: score={r.get('score')} model={r.get('model')} issues={r.get('issues')} ({time.time()-t:.1f}s)")

# 3. TTS - mms-tts-yor already cached
t = time.time()
from app.worker import _run_tts
out = os.path.join(uploads, 'test_yor.wav')
r = _run_tts('E kaaro', 'yor', {}, out)
print(f"[3] TTS    : model={r.get('model')} file_ok={os.path.exists(out)} ({time.time()-t:.1f}s)")

# 4. Translation - nllb already cached (first call downloads tokenizer config only)
t = time.time()
from app.worker import _run_translation
r = _run_translation('Habari za asubuhi.', 'swa_Latn', 'eng_Latn', {'config': {'max_length': 64}})
print(f"[4] Translate: {r.get('translation')} model={r.get('model')} ({time.time()-t:.1f}s)")

print("All done.")
