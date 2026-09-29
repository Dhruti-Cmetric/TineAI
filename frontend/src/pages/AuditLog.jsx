import { useEffect, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import api from '../api/client'

const actionColor = {
  UPLOAD_DATASET: '#1a56db', STATUS_CHANGE: '#7c3aed', AI_ENRICH: '#059669',
  ASSIGN_DATASET: '#0891b2', GENERATE_API_KEY: '#d97706', API_ACCESS: '#be185d',
  CREATE_USER: '#64748b'
}

export default function AuditLog() {
  const [logs, setLogs] = useState([])
  const [filter, setFilter] = useState({ action: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/audit/', { params: { action: filter.action || undefined, limit: 200 } })
      .then(r => setLogs(r.data))
      .finally(() => setLoading(false))
  }, [filter])

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Audit Log</h2>
          <p className="text-muted text-sm mt-2">{logs.length} records — chronological trail of all platform actions</p>
        </div>
      </div>

      <div className="alert alert-info" style={{ marginBottom:20 }}>
        <ClipboardList size={14} style={{ display:'inline', marginRight:6 }} />
        Every state change, approval, API access event and user action is logged here with actor, action and timestamp.
      </div>

      <div className="card" style={{ marginBottom:16, padding:16 }}>
        <div style={{ display:'flex', gap:12, alignItems:'center' }}>
          <input className="form-input" style={{ maxWidth:240 }} placeholder="Filter by action..." value={filter.action}
            onChange={e => setFilter(f => ({...f, action: e.target.value}))} />
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {Object.keys(actionColor).map(a => (
              <button key={a} className="btn btn-sm" style={{ background: filter.action === a ? actionColor[a] : 'var(--bg)', color: filter.action === a ? '#fff' : 'var(--muted)', border:'1px solid var(--border)', fontSize:11 }}
                onClick={() => setFilter(f => ({...f, action: f.action === a ? '' : a}))}>
                {a.replace(/_/g,' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state"><div className="spinner" style={{ margin:'0 auto' }} /></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Role</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id}>
                    <td className="text-muted" style={{ whiteSpace:'nowrap', fontSize:12 }}>
                      {new Date(l.timestamp).toLocaleString()}
                    </td>
                    <td style={{ fontWeight:500, fontSize:13 }}>{l.actor}</td>
                    <td><span className={`badge badge-${l.role}`}>{l.role}</span></td>
                    <td>
                      <span style={{ background: (actionColor[l.action] || '#64748b') + '20', color: actionColor[l.action] || '#64748b', padding:'2px 8px', borderRadius:20, fontSize:11.5, fontWeight:600, whiteSpace:'nowrap' }}>
                        {l.action}
                      </span>
                    </td>
                    <td className="text-muted" style={{ fontSize:12 }}>{l.entity_type} #{l.entity_id}</td>
                    <td style={{ fontSize:12, maxWidth:320 }}>{l.detail}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--muted)', padding:32 }}>No logs found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
