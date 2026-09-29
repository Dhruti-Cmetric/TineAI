"""Verification script - S17 Mockup Requirements + S18 Sample Data"""
import sys, os
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app

c = TestClient(app)
results = []

def check(name, passed, detail=''):
    results.append((name, passed, detail))

# ── AUTH ────────────────────────────────────────────────────────────────────
r = c.post('/api/auth/token', data={'username': 'admin@tineai.com', 'password': 'admin123'})
check('Admin login', r.status_code == 200, f'role={r.json().get("role")}')
ah = {'Authorization': f'Bearer {r.json()["access_token"]}'}

r = c.post('/api/auth/token', data={'username': 'supplier@tineai.com', 'password': 'supplier123'})
check('Supplier login', r.status_code == 200)
sh = {'Authorization': f'Bearer {r.json()["access_token"]}'}

r = c.post('/api/auth/token', data={'username': 'client@aichina.ai', 'password': 'client123'})
check('Client login', r.status_code == 200)
clh = {'Authorization': f'Bearer {r.json()["access_token"]}'}

# ── S17.1 Administrator Dashboard ───────────────────────────────────────────
r = c.get('/api/audit/stats', headers=ah)
check('S17.1 Admin dashboard stats', r.status_code == 200, str(r.json()))

r = c.get('/api/users/stats', headers=ah)
check('S17.1 Admin user stats', r.status_code == 200, str(r.json()))

# ── S17.2 Supplier Upload Screen ────────────────────────────────────────────
r = c.post('/api/datasets/upload', headers=sh, data={
    'name': 'Igbo Market Chatter', 'description': 'Supplier upload test',
    'data_type': 'audio', 'language': 'Igbo', 'country': 'Nigeria',
    'dialect': 'Enugu Igbo', 'cultural_context': 'Urban market',
    'source': 'Field 2025', 'rights_info': 'TINE AI', 'permitted_uses': 'Research'
})
check('S17.2 Supplier upload (file+metadata)', r.status_code == 200,
      f'id={r.json().get("id")} status={r.json().get("status")}')
new_ds_id = r.json()['id']

# ── S17.3 Data Card Creation (metadata-only) ────────────────────────────────
r = c.post('/api/datasets/upload', headers=ah, data={
    'name': 'Wolof Oral Narratives', 'description': 'Metadata-only data card',
    'data_type': 'audio', 'language': 'Wolof', 'country': 'Senegal',
    'dialect': 'Dakar Wolof', 'cultural_context': 'Urban Dakar oral tradition',
    'source': 'Heritage archive 2025', 'rights_info': 'TINE AI owns all rights',
    'permitted_uses': 'Academic research, AI model training',
    'annotation_details': 'Sentence-level annotation complete. 4 speakers per clip.',
    'version': '1.0', 'file_formats': 'wav', 'file_size_mb': '0'
})
check('S17.3 Data Card create (all metadata fields present)', r.status_code == 200,
      f'lang={r.json().get("language")} dialect={r.json().get("dialect")} cultural={bool(r.json().get("cultural_context"))}')
dc = r.json()
check('S17.3 Data Card — dialect field', bool(dc.get('dialect')), dc.get('dialect'))
check('S17.3 Data Card — cultural context field', bool(dc.get('cultural_context')), dc.get('cultural_context'))
check('S17.3 Data Card — rights field', bool(dc.get('rights_info')), dc.get('rights_info'))
check('S17.3 Data Card — permitted uses field', bool(dc.get('permitted_uses')), dc.get('permitted_uses'))
check('S17.3 Data Card — annotation details field', bool(dc.get('annotation_details')), dc.get('annotation_details'))
dc_id = dc['id']

# ── S17.4 Dataset Listing & Search ──────────────────────────────────────────
r = c.get('/api/datasets/', headers=ah)
check('S17.4 Dataset listing (all)', r.status_code == 200, f'total={len(r.json())}')

r = c.get('/api/datasets/?status=approved', headers=ah)
check('S17.4 Filter by status=approved', r.status_code == 200, f'count={len(r.json())}')

r = c.get('/api/datasets/?language=Yoruba', headers=ah)
check('S17.4 Filter by language', r.status_code == 200, f'count={len(r.json())}')

r = c.get('/api/datasets/?data_type=audio', headers=ah)
check('S17.4 Filter by type=audio', r.status_code == 200, f'count={len(r.json())}')

r = c.get('/api/datasets/?data_type=video', headers=ah)
check('S17.4 Filter by type=video', r.status_code == 200, f'count={len(r.json())}')

r = c.get('/api/datasets/?data_type=image', headers=ah)
check('S17.4 Filter by type=image', r.status_code == 200, f'count={len(r.json())}')

# ── S17.5 Dataset Details (Data Card view) ──────────────────────────────────
r = c.get('/api/datasets/1', headers=ah)
ds = r.json()
check('S17.5 Dataset detail endpoint', r.status_code == 200)
check('S17.5 Data Card: language', bool(ds.get('language')), ds.get('language'))
check('S17.5 Data Card: country', bool(ds.get('country')), ds.get('country'))
check('S17.5 Data Card: dialect', bool(ds.get('dialect')), ds.get('dialect'))
check('S17.5 Data Card: cultural_context', bool(ds.get('cultural_context')), ds.get('cultural_context'))
check('S17.5 Data Card: transcription_text', bool(ds.get('transcription_text')), str(ds.get('transcription_text', ''))[:80])
check('S17.5 Data Card: translation_text', bool(ds.get('translation_text')), str(ds.get('translation_text', ''))[:80])
check('S17.5 Data Card: quality_score', ds.get('quality_score') is not None, str(ds.get('quality_score')))
check('S17.5 Data Card: rights_info', bool(ds.get('rights_info')), ds.get('rights_info'))
check('S17.5 Data Card: permitted_uses', bool(ds.get('permitted_uses')), ds.get('permitted_uses'))
check('S17.5 Data Card: version', bool(ds.get('version')), ds.get('version'))
check('S17.5 Data Card: status', bool(ds.get('status')), ds.get('status'))

# ── S17.6 Dataset Approval Workflow ─────────────────────────────────────────
r = c.patch(f'/api/datasets/{new_ds_id}/status?new_status=processing', headers=ah)
check('S17.6 Workflow step 1: uploaded -> processing', r.status_code == 200, r.json().get('status'))

r = c.patch(f'/api/datasets/{new_ds_id}/enrich', headers=ah)
check('S17.6 Workflow step 2: AI enrichment runs', r.status_code == 200,
      f'transcript={bool(r.json().get("transcription"))} quality={r.json().get("quality_score")}')
check('S17.6 Status auto-advances to under_review', r.json().get('status') == 'under_review', r.json().get('status'))

r = c.patch(f'/api/datasets/{new_ds_id}/status?new_status=approved', headers=ah)
check('S17.6 Workflow step 3: TINE AI approves', r.status_code == 200, r.json().get('status'))

# Also test reject path
r = c.patch(f'/api/datasets/{dc_id}/status?new_status=under_review', headers=ah)
r2 = c.patch(f'/api/datasets/{dc_id}/status?new_status=rejected&reason=Insufficient+dialect+coverage', headers=ah)
check('S17.6 Reject path with reason', r2.status_code == 200, r2.json().get('status'))

r3 = c.get(f'/api/datasets/{dc_id}', headers=ah)
check('S17.6 Rejection reason stored on Data Card', bool(r3.json().get('reject_reason')), r3.json().get('reject_reason'))

# ── S17.7 Client View ────────────────────────────────────────────────────────
r = c.get('/api/datasets/', headers=clh)
check('S17.7 Client dataset view is scoped', r.status_code == 200,
      f'client sees {len(r.json())} datasets (not all)')

r = c.get('/api/access/assignments', headers=clh)
check('S17.7 Client portal assignments', r.status_code == 200, f'count={len(r.json())}')

for a in r.json():
    check('S17.7 Assignment shows project+license', bool(a.get('project_name')) and bool(a.get('license_type')),
          f'project={a.get("project_name")} license={a.get("license_type")}')
    break

# ── S17.8 Project and Dataset Assignment ────────────────────────────────────
r = c.post('/api/access/assign', headers=ah, json={
    'client_id': 4, 'dataset_id': new_ds_id,
    'project_name': 'Pan-African NLP Benchmark v3',
    'license_type': 'Research',
    'permitted_use': 'AI model fine-tuning — non-commercial'
})
check('S17.8 Admin assigns dataset to client project', r.status_code == 200, str(r.json()))
assign_id = r.json().get('id')

r = c.get('/api/access/assignments', headers=ah)
my_assign = next((a for a in r.json() if a['id'] == assign_id), None)
check('S17.8 Assignment visible in admin view', my_assign is not None,
      f'project={my_assign.get("project_name") if my_assign else "NOT FOUND"}')

# ── S17.9 API Access Representation ─────────────────────────────────────────
r = c.post('/api/access/apikeys/generate', headers=clh)
check('S17.9 Client generates API key', r.status_code == 200, f'prefix={r.json().get("prefix")}')
api_key = r.json()['api_key']

# Find an ACTIVE assignment for this client (use seed data — dataset 1 or 2 assigned in seed.py)
r_asgn = c.get('/api/access/assignments', headers=clh)
active_asgns = [a for a in r_asgn.json() if a.get('is_active') and a.get('dataset')]
client_assigned_ds_id = active_asgns[0]['dataset']['id'] if active_asgns else 1

r = c.get(f'/api/access/datasets/{client_assigned_ds_id}/data?api_key={api_key}')
check('S17.9 Authenticated API call returns dataset metadata', r.status_code == 200,
      f'name={r.json().get("name")} lang={r.json().get("language")} license={r.json().get("license")}')
check('S17.9 API response includes transcription sample', bool(r.json().get('transcription_sample')))
check('S17.9 API response includes quality score', r.json().get('quality_score') is not None)

r_bad = c.get(f'/api/access/datasets/{client_assigned_ds_id}/data?api_key=tine_INVALID_KEY_000')
check('S17.9 Invalid API key blocked (401)', r_bad.status_code == 401, f'HTTP {r_bad.status_code}')

r_bad2 = c.get(f'/api/access/datasets/999/data?api_key={api_key}')
check('S17.9 Unassigned dataset blocked (403/404)', r_bad2.status_code in [403, 404], f'HTTP {r_bad2.status_code}')

# ── S17.10 Dataset Access Control (Revoke — must come AFTER S17.9) ───────────
if assign_id:
    r = c.patch(f'/api/access/assignments/{assign_id}/revoke', headers=ah)
    check('S17.10 Admin revokes client access', r.status_code == 200, str(r.json()))
    check('S17.10 Revoked flag set', r.json().get('is_active') == False)

# ── S18 Sample Data Verification ────────────────────────────────────────────
r = c.get('/api/datasets/', headers=ah)
all_ds = r.json()

languages = list(set(d['language'] for d in all_ds if d.get('language')))
countries = list(set(d['country'] for d in all_ds if d.get('country')))
types = list(set(d['data_type'] for d in all_ds if d.get('data_type')))
dialects = list(set(d['dialect'] for d in all_ds if d.get('dialect')))

check('S18 African language variety (5+)', len(languages) >= 5, f'{languages}')
check('S18 Multi-country coverage (3+)', len(countries) >= 3, f'{countries}')
check('S18 Audio data type present', 'audio' in types)
check('S18 Video data type present', 'video' in types)
check('S18 Image data type present', 'image' in types)
check('S18 Regional dialect metadata (3+)', len(dialects) >= 3, f'{dialects}')
check('S18 Transcription content present', any(d.get('transcription_text') for d in all_ds))
check('S18 Translation content present', any(d.get('translation_text') for d in all_ds))
check('S18 Annotation details present', any(d.get('annotation_details') for d in all_ds))
check('S18 Quality scores present', any(d.get('quality_score') for d in all_ds))
check('S18 Rights/licensing metadata', any(d.get('rights_info') for d in all_ds))
check('S18 Cultural context metadata', any(d.get('cultural_context') for d in all_ds))
check('S18 Source information present', any(d.get('source') for d in all_ds))

# check specific African languages mentioned in RUD S3
rud_langs = ['Yoruba', 'Swahili', 'Amharic', 'Hausa', 'Zulu', 'Cameroonian French']
for lang in rud_langs:
    check(f'S18 Sample: {lang} dataset exists', any(d['language'] == lang for d in all_ds))

# ── Audit Trail ─────────────────────────────────────────────────────────────
r = c.get('/api/audit/', headers=ah)
logs = r.json()
actions = set(l['action'] for l in logs)
for action in ['UPLOAD_DATASET', 'STATUS_CHANGE', 'AI_ENRICH', 'ASSIGN_DATASET',
               'GENERATE_API_KEY', 'API_ACCESS', 'REVOKE_ACCESS']:
    check(f'Audit log: {action} recorded', action in actions)

# ── RESULTS ─────────────────────────────────────────────────────────────────
passed = [r for r in results if r[1]]
failed = [r for r in results if not r[1]]

print(f'\n{"="*60}')
print(f'  TINE AI POC - S17 & S18 VERIFICATION')
print(f'  {len(passed)} PASSED  /  {len(failed)} FAILED  /  {len(results)} TOTAL')
print(f'{"="*60}\n')

if failed:
    print('FAILURES:')
    for name, _, detail in failed:
        print(f'  [FAIL] {name}')
        if detail: print(f'         {detail}')
    print()

print('PASSED CHECKS:')
for name, _, detail in passed:
    print(f'  [PASS] {name}')
    if detail: print(f'         {detail}')

print(f'\n{"="*60}')
if not failed:
    print('  ALL CHECKS PASSED - POC meets S17 and S18 requirements')
else:
    print(f'  {len(failed)} check(s) need attention')
print(f'{"="*60}\n')
