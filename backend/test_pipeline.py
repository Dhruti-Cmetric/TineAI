# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
"""
test_pipeline.py — smoke-test every pipeline endpoint against the running API.
Run: .\venv\Scripts\python.exe test_pipeline.py

Requires the backend running on http://localhost:8002
"""
import json
import urllib.request, urllib.parse

BASE = "http://localhost:8002"
EMAIL = "admin@tineai.com"
PASSWORD = "admin123"

def post(path, body=None, token=None, form=False):
    url = BASE + path
    if form and body:
        data = urllib.parse.urlencode(body).encode()
        req = urllib.request.Request(url, data=data)
    else:
        data = json.dumps(body or {}).encode()
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        res = urllib.request.urlopen(req, timeout=30)
        return json.loads(res.read())
    except urllib.error.HTTPError as e:
        return {"error": e.code, "detail": e.read().decode()}

def get(path, token=None):
    req = urllib.request.Request(BASE + path)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        res = urllib.request.urlopen(req, timeout=30)
        return json.loads(res.read())
    except urllib.error.HTTPError as e:
        return {"error": e.code, "detail": e.read().decode()}

def ok(label, result, check_key=None):
    has_error = "error" in result
    passed = not has_error and (check_key is None or check_key in result)
    icon = "PASS" if passed else "FAIL"
    val = result.get(check_key, result) if check_key else list(result.keys())[:3]
    print(f"  {icon} {label}: {val}")
    return passed

print("\n=== TINE AI Pipeline Smoke Test ===\n")
fails = 0

# 1. Auth
print("[1] Auth")
r = post("/api/auth/token", {"username": EMAIL, "password": PASSWORD}, form=True)
passed = ok("Login", r, "access_token")
if not passed:
    print("  Cannot continue without auth token. Is the server running on port 8002?")
    sys.exit(1)
token = r["access_token"]

# 2. Model registry
print("\n[2] Model Registry")
r = post("/api/models/seed-defaults", token=token)
ok("Seed defaults", r, "seeded")

r = get("/api/models/", token=token)
ok("List models", {"count": len(r)}, "count") if isinstance(r, list) else ok("List models", r)

# 3. Datasets
print("\n[3] Datasets")
r = get("/api/datasets/", token=token)
datasets = r if isinstance(r, list) else []
ok("List datasets", {"count": len(datasets)}, "count") if isinstance(r, list) else ok("List datasets", r)
ds_id = datasets[0]["id"] if datasets else None

if ds_id:
    # 4. Pipeline trigger
    print(f"\n[4] Pipeline (dataset_id={ds_id})")
    r = post(f"/api/pipeline/run/{ds_id}", {"tgt_lang": "eng_Latn"}, token=token)
    ok("Trigger pipeline", r, "job_id")
    job_id = r.get("job_id")

    if job_id:
        r = get(f"/api/pipeline/jobs/{job_id}", token=token)
        ok("Job status", r, "status")
        print(f"     steps: {[s['task_type']+':'+s['status'] for s in r.get('steps', [])]}")

    # 5. Processing tasks (legacy)
    r = get(f"/api/datasets/{ds_id}/processing", token=token)
    ok("Processing tasks", {"count": len(r)}, "count") if isinstance(r, list) else ok("Processing tasks", r)
else:
    print("\n  WARN: No datasets found — run seed.py first")
    fails += 1

# 5. Language ID
print("\n[5] Language Identification")
r = get("/api/language-id/supported", token=token)
ok("Supported languages", r, "count")

r = post("/api/language-id/detect",
         {"text": "Habari za asubuhi nimefurahi kukutana nawe"},
         token=token, form=True)
ok("Detect language (Swahili text)", r, "top_language")

# 6. Translation
print("\n[6] Translation")
r = get("/api/translation/languages", token=token)
ok("Translation languages", r, "count")

r = post("/api/translation/translate",
         {"text": "Habari za asubuhi", "src_lang": "swa_Latn", "tgt_lang": "eng_Latn"},
         token=token)
ok("Translate swa->eng", r, "translation")

# 7. TTS languages
print("\n[7] Text-to-Speech")
r = get("/api/tts/languages", token=token)
ok("TTS languages", r, "count")

# 8. OCR endpoint reachable
print("\n[8] OCR")
r = get("/api/models/?task_type=ocr", token=token)
ok("OCR model registered", {"count": len(r)}, "count") if isinstance(r, list) else ok("OCR model", r)

# 9. Audit log
print("\n[9] Audit Log")
r = get("/api/audit/", token=token)
ok("Audit entries", {"count": len(r)}, "count") if isinstance(r, list) else ok("Audit", r)

print(f"\n{'='*40}")
print(f"Done. Check ❌ items above for failures.")
print(f"Swagger UI: {BASE}/docs\n")
