import os, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from app.worker import detect_language_and_region, _LANG_GEO

print(f"Lang map covers {len(_LANG_GEO)} languages")

uploads = './uploads'
mp4 = next((os.path.join(uploads, f) for f in os.listdir(uploads) if f.endswith('.mp4')), None)
print(f"Testing on: {mp4}")

r = detect_language_and_region(mp4, 'video')
print(f"Model   : {r['model']}")
print(f"Language: {r['language']} ({r['language_code']})")
print(f"Country : {r['country']}")
print(f"Dialect : {r['dialect']}")
print(f"Conf    : {r['confidence']}")
print(f"Top5    : {r.get('top5', [])}")
