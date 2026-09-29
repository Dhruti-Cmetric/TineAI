import sys; sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from fastapi.testclient import TestClient
from app.main import app
c = TestClient(app)
r = c.post('/api/auth/token', data={'username': 'client@aichina.ai', 'password': 'client123'})
tok = r.json()['access_token']
clh = {'Authorization': f'Bearer {tok}'}

asgns = c.get('/api/access/assignments', headers=clh).json()
print('Active client assignments:', len([a for a in asgns if a['is_active']]))
for a in asgns:
    ds = a.get('dataset', {})
    print(f'  assign_id={a["id"]} active={a["is_active"]} ds_id={ds.get("id")} ds_name={ds.get("name")}')

# get first active one
active = [a for a in asgns if a['is_active'] and a.get('dataset')]
if active:
    ds_id = active[0]['dataset']['id']
    r2 = c.post('/api/access/apikeys/generate', headers=clh)
    key = r2.json()['api_key']
    r3 = c.get(f'/api/access/datasets/{ds_id}/data?api_key={key}')
    print(f'API call ds_id={ds_id}: HTTP {r3.status_code}')
    print(r3.json())
else:
    print('No active assignments found for client')
