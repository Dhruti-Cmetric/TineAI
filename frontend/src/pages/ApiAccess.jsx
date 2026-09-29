import { useEffect, useState } from 'react'
import { Key, Copy, Eye, EyeOff } from 'lucide-react'
import api from '../api/client'
import toast from 'react-hot-toast'

export default function ApiAccess() {
  const [keys, setKeys] = useState([])
  const [newKey, setNewKey] = useState(null)
  const [testResult, setTestResult] = useState(null)
  const [testLoading, setTestLoading] = useState(false)
  const [testKeyInput, setTestKeyInput] = useState('')
  const [testDatasetId, setTestDatasetId] = useState('')
  const role = localStorage.getItem('role')

  useEffect(() => { api.get('/access/apikeys').then(r => setKeys(r.data)) }, [])

  async function generateKey() {
    const { data } = await api.post('/access/apikeys/generate')
    setNewKey(data.api_key)
    toast.success('API key generated!')
    api.get('/access/apikeys').then(r => setKeys(r.data))
  }

  async function testApi() {
    if (!testKeyInput || !testDatasetId) { toast.error('Enter API key and dataset ID'); return }
    setTestLoading(true)
    setTestResult(null)
    try {
      const { data } = await api.get(`/access/datasets/${testDatasetId}/data?api_key=${testKeyInput}`)
      setTestResult({ success: true, data })
    } catch(err) {
      setTestResult({ success: false, error: err.response?.data?.detail || 'Error' })
    } finally { setTestLoading(false) }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>API Access</h2>
          <p className="text-muted text-sm mt-2">Manage API keys for dataset access</p>
        </div>
        <button className="btn btn-primary" onClick={generateKey}>
          <Key size={14} /> Generate API Key
        </button>
      </div>

      {newKey && (
        <div className="alert alert-success" style={{ marginBottom:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <strong>New API Key Generated</strong>
              <div style={{ fontFamily:'monospace', marginTop:4, fontSize:13, wordBreak:'break-all' }}>{newKey}</div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => { navigator.clipboard.writeText(newKey); toast.success('Copied!') }}>
              <Copy size={12} /> Copy
            </button>
          </div>
          <p className="text-sm" style={{ marginTop:6, opacity:0.8 }}>⚠️ Store this key securely — it will not be shown again.</p>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
        <div className="card">
          <div className="card-title">Your API Keys</div>
          {keys.length === 0 ? (
            <div className="text-muted text-sm">No API keys yet. Generate one above.</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {keys.map(k => (
                <div key={k.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', background:'var(--bg)', borderRadius:'var(--radius)' }}>
                  <div>
                    <div style={{ fontFamily:'monospace', fontWeight:600 }}>{k.prefix}••••••••••••</div>
                    <div className="text-muted text-sm">Created {new Date(k.created_at).toLocaleDateString()}</div>
                  </div>
                  <span style={{ color: k.is_active ? 'var(--success)' : 'var(--danger)', fontSize:12, fontWeight:500 }}>
                    {k.is_active ? '● Active' : '○ Revoked'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">API Documentation</div>
          <div style={{ fontSize:13, lineHeight:1.8 }}>
            <div style={{ marginBottom:10 }}>
              <strong>Endpoint:</strong>
              <div style={{ fontFamily:'monospace', background:'#0f172a', color:'#a5f3fc', padding:'8px 10px', borderRadius:'var(--radius)', marginTop:4, fontSize:12 }}>
                GET /api/access/datasets/:id/data?api_key=YOUR_KEY
              </div>
            </div>
            <div style={{ marginBottom:10 }}>
              <strong>Authentication:</strong> API Key via query parameter
            </div>
            <div>
              <strong>Returns:</strong> Dataset metadata, transcription sample, quality score, licensing info
            </div>
          </div>
        </div>
      </div>

      {/* Live API Test */}
      <div className="card">
        <div className="card-title">🔬 Live API Demo</div>
        <p className="text-muted text-sm" style={{ marginBottom:16 }}>Test your API key against an approved dataset in real-time.</p>
        <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
          <input className="form-input" style={{ flex:2, minWidth:200 }} placeholder="Paste your API key..." value={testKeyInput} onChange={e => setTestKeyInput(e.target.value)} />
          <input className="form-input" style={{ flex:1, minWidth:120 }} placeholder="Dataset ID (e.g. 1)" type="number" value={testDatasetId} onChange={e => setTestDatasetId(e.target.value)} />
          <button className="btn btn-primary" onClick={testApi} disabled={testLoading}>
            {testLoading ? <span className="spinner" /> : 'Test API Call'}
          </button>
        </div>

        {testResult && (
          <div style={{ background:'#0f172a', borderRadius:'var(--radius)', padding:16 }}>
            <div style={{ color: testResult.success ? '#34d399' : '#f87171', fontSize:12, marginBottom:8, fontWeight:600 }}>
              {testResult.success ? '✓ 200 OK' : '✗ Error'}
            </div>
            <pre style={{ color:'#e2e8f0', fontSize:12, whiteSpace:'pre-wrap', margin:0, lineHeight:1.7 }}>
              {JSON.stringify(testResult.success ? testResult.data : { error: testResult.error }, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
