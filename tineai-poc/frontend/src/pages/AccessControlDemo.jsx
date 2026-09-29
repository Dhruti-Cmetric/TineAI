import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, ShieldAlert, Clock } from 'lucide-react'
import api from '../api/client'
import toast from 'react-hot-toast'

export default function AccessControlDemo() {
  const [apiKey, setApiKey] = useState('tine_demo_client_key_001')
  const [scenarios, setScenarios] = useState(null)
  const [manualDs, setManualDs] = useState('')
  const [manualResult, setManualResult] = useState(null)
  const [loading, setLoading] = useState(false)

  async function runScenarios() {
    setLoading(true)
    try {
      const { data } = await api.get(`/access/demo/scenarios?api_key=${apiKey}`)
      setScenarios(data)
    } catch { toast.error('Failed to load scenarios') }
    finally { setLoading(false) }
  }

  async function testManual() {
    setManualResult(null)
    try {
      const { data } = await api.get(`/access/datasets/${manualDs}/data?api_key=${apiKey}`)
      setManualResult({ code: 200, label:'200 OK', color:'var(--success)', data })
    } catch (err) {
      const status = err.response?.status || 500
      const detail = err.response?.data?.detail || 'Error'
      setManualResult({ code: status, label:`${status} ${status===401?'Unauthorized':status===403?'Forbidden':'Error'}`, color:'var(--danger)', detail })
    }
  }

  const scenarioIcon = r => r === '200 OK'
    ? <CheckCircle size={16} color="var(--success)"/>
    : <XCircle size={16} color="var(--danger)"/>

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Access Control Demo</h2>
          <p className="text-muted text-sm mt-2">§9.15 — Demonstrate 200 OK, 403 Forbidden (revoked, expired, suspended) scenarios</p>
        </div>
      </div>

      {/* Explain the 4 scenarios */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12, marginBottom:24 }}>
        {[
          { title:'Valid Access — 200 OK', desc:'Client + Project + Dataset v1 + Active License', color:'var(--success)', icon:<CheckCircle size={20}/> },
          { title:'No Assignment — 403', desc:'Client has no assignment for this dataset', color:'var(--danger)', icon:<XCircle size={20}/> },
          { title:'Expired License — 403', desc:'License end date has passed', color:'var(--warning)', icon:<Clock size={20}/> },
          { title:'Suspended Dataset — 403', desc:'Dataset is suspended or revoked by TINE AI', color:'var(--danger)', icon:<ShieldAlert size={20}/> },
        ].map(s => (
          <div key={s.title} className="card" style={{ borderLeft:`4px solid ${s.color}` }}>
            <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
              <div style={{ color:s.color, marginTop:2 }}>{s.icon}</div>
              <div>
                <div style={{ fontWeight:600, fontSize:13, marginBottom:2 }}>{s.title}</div>
                <div className="text-muted text-sm">{s.desc}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* API key input */}
      <div className="card" style={{ marginBottom:20 }}>
        <div className="card-title">API Key</div>
        <div style={{ display:'flex', gap:10 }}>
          <input className="form-input" value={apiKey} onChange={e => setApiKey(e.target.value)}
            placeholder="Paste API key or use pre-seeded demo key" style={{ flex:1, fontFamily:'monospace', fontSize:13 }} />
          <button className="btn btn-primary" onClick={runScenarios} disabled={loading}>
            {loading ? <span className="spinner"/> : 'Run All Scenarios'}
          </button>
        </div>
        <p className="text-muted text-sm" style={{ marginTop:6 }}>Demo key: <code>tine_demo_client_key_001</code> (pre-seeded for AI Research Lab Ltd.)</p>
      </div>

      {/* Scenario results */}
      {scenarios && (
        <div className="card" style={{ marginBottom:20 }}>
          <div className="card-title">Access Control Results</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Dataset</th><th>Status</th><th>Version</th><th>Assignment</th><th>Expired</th><th>Result</th><th>Reason</th></tr></thead>
              <tbody>
                {scenarios.scenarios.map((s, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight:500 }}>{s.dataset}</td>
                    <td><span className={`badge badge-${s.status}`}>{s.status}</span></td>
                    <td>{s.version}</td>
                    <td><span style={{ color:s.assignment_active?'var(--success)':'var(--danger)', fontWeight:600 }}>{s.assignment_active?'Active':'Revoked'}</span></td>
                    <td><span style={{ color:s.expired?'var(--danger)':'var(--success)', fontWeight:600 }}>{s.expired?'Yes':'No'}</span></td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        {scenarioIcon(s.result)}
                        <span style={{ fontWeight:700, color:s.result==='200 OK'?'var(--success)':'var(--danger)', fontFamily:'monospace', fontSize:13 }}>{s.result}</span>
                      </div>
                    </td>
                    <td className="text-muted text-sm">{s.reason || 'All checks passed'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual dataset test */}
      <div className="card">
        <div className="card-title">Manual API Call Test</div>
        <div style={{ display:'flex', gap:10, marginBottom:12 }}>
          <input className="form-input" type="number" placeholder="Dataset ID (1-6)" value={manualDs}
            onChange={e => setManualDs(e.target.value)} style={{ width:160 }} />
          <button className="btn btn-primary" onClick={testManual}>Test</button>
        </div>
        {manualResult && (
          <div style={{ background:'#0f172a', borderRadius:'var(--radius)', padding:16 }}>
            <div style={{ color:manualResult.color, fontSize:13, fontWeight:700, marginBottom:8, fontFamily:'monospace' }}>
              HTTP {manualResult.label}
            </div>
            <pre style={{ color:'#e2e8f0', fontSize:12, whiteSpace:'pre-wrap', margin:0, lineHeight:1.7 }}>
              {JSON.stringify(manualResult.data || { error: manualResult.detail }, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
