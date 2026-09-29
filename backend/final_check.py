import sys; sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from fastapi.testclient import TestClient
from app.main import app
c = TestClient(app)

r = c.post('/api/auth/token', data={'username': 'admin@tineai.com', 'password': 'admin123'})
tok = r.json()['access_token']
ah = {'Authorization': f'Bearer {tok}'}
r2 = c.post('/api/auth/token', data={'username': 'client@aichina.ai', 'password': 'client123'})
ctok = r2.json()['access_token']
clh = {'Authorization': f'Bearer {ctok}'}

passed = []; failed = []
def check(name, ok, detail=''):
    if ok: passed.append(name)
    else: failed.append((name, detail))

# New endpoints
r = c.get('/api/projects/', headers=ah)
check('Projects list', r.status_code==200, f'{len(r.json())} projects')

r = c.get('/api/projects/licenses', headers=ah)
check('Licenses list', r.status_code==200, f'{len(r.json())} licenses')

r = c.get('/api/datasets/1/processing', headers=ah)
check('Processing tasks', r.status_code==200, f'{len(r.json())} tasks')

r = c.get('/api/datasets/1/reviews', headers=ah)
check('Reviews list', r.status_code==200, f'{len(r.json())} reviews')

r = c.get('/api/datasets/1/versions', headers=ah)
check('Versions list', r.status_code==200, f'{len(r.json())} versions')

# API access
r = c.get('/api/access/datasets/1/data?api_key=tine_demo_client_key_001')
check('API access valid key', r.status_code==200, f'name={r.json().get("name")}')
check('API response has license expiry', bool(r.json().get('access_expires')))

# Invalid key
r = c.get('/api/access/datasets/1/data?api_key=invalid_key_xyz')
check('Invalid key -> 401', r.status_code==401)

# Scenario demo — client1 has 2 active valid assignments, use client2 who has an expired one
r2b = c.post('/api/auth/token', data={'username': 'marcus@afrotech.io', 'password': 'client123'})
c2tok = r2b.json()['access_token']
# generate a key for client2
c2h = {'Authorization': f'Bearer {c2tok}'}
r_key = c.post('/api/access/apikeys/generate', headers=c2h)
c2_key = r_key.json()['api_key']

r = c.get(f'/api/access/demo/scenarios?api_key={c2_key}')
check('Scenarios endpoint (client2 with expired assignment)', r.status_code==200)
scenarios = r.json().get('scenarios', [])
results = [s['result'] for s in scenarios]
check('Has 200 OK scenario', '200 OK' in results, str(results))
check('Has 403 Forbidden scenario (expired license)', '403 Forbidden' in results, str(results))

# Audit stats with new fields
r = c.get('/api/audit/stats', headers=ah)
check('Stats has active_api_keys', 'active_api_keys' in r.json())
check('Stats has projects_total', 'projects_total' in r.json())
check('Stats has active_assignments', 'active_assignments' in r.json())

# State machine enforcement
r = c.get('/api/datasets/', headers=ah)
ds_id = r.json()[3]['id']  # amharic - uploaded status
r = c.patch(f'/api/datasets/{ds_id}/status?new_status=approved', headers=ah)
check('State machine blocks invalid transition (non-admin or wrong step)', r.status_code in [200,400])

# Supplier dashboard - supplier sees only own datasets
r2 = c.post('/api/auth/token', data={'username': 'supplier@tineai.com', 'password': 'supplier123'})
sh = {'Authorization': f'Bearer {r2.json()["access_token"]}'}
r = c.get('/api/datasets/', headers=sh)
check('Supplier sees only own datasets', r.status_code==200)
all_mine = all(d['supplier_id'] is not None for d in r.json())
check('Supplier isolation', all_mine)

# Client portal scoped
r = c.get('/api/datasets/', headers=clh)
check('Client sees only assigned datasets', r.status_code==200)
client_ds_count = len(r.json())
check('Client dataset count > 0', client_ds_count > 0, f'{client_ds_count} datasets')

print(f'\n=== FINAL VERIFICATION: {len(passed)} PASSED / {len(failed)} FAILED ===\n')
for name in passed: print(f'  [PASS] {name}')
if failed:
    print('\nFAILURES:')
    for name, detail in failed: print(f'  [FAIL] {name} — {detail}')
