import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Globe, Lock } from 'lucide-react'
import api from '../api/client'

export default function ClientPortal() {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const nav = useNavigate()
  const role = localStorage.getItem('role')
  const name = localStorage.getItem('name')

  useEffect(() => {
    api.get('/access/assignments').then(r => {
      setAssignments(r.data)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="empty-state"><div className="spinner" style={{ margin:'0 auto' }} /></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Client Portal</h2>
          <p className="text-muted text-sm mt-2">
            {role === 'client' ? `Welcome, ${name}. Datasets authorized for your projects.` : 'All client dataset assignments'}
          </p>
        </div>
      </div>

      {role === 'client' && (
        <div className="alert alert-info" style={{ marginBottom:20 }}>
          <Lock size={14} style={{ display:'inline', marginRight:6 }} />
          <strong>Access Controlled by TINE AI.</strong> You can only see datasets explicitly assigned to your project. All access is logged and auditable.
        </div>
      )}

      {assignments.length === 0 ? (
        <div className="empty-state">
          <Globe size={40} />
          <p>No dataset assignments found.</p>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:16 }}>
          {assignments.map(a => (
            <div key={a.id} className="card" style={{ borderTop:'3px solid var(--accent)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:15, marginBottom:4 }}>{a.dataset?.name}</div>
                  <div style={{ display:'flex', gap:6 }}>
                    <span className={`badge badge-${a.dataset ? 'audio' : ''}`}>{a.dataset?.language}</span>
                    <span className="badge" style={{ background:'#f1f5f9', color:'var(--muted)' }}>{a.dataset?.country}</span>
                  </div>
                </div>
                <span style={{ color: a.is_active ? 'var(--success)' : 'var(--danger)', fontSize:12, fontWeight:500 }}>
                  {a.is_active ? '● Active' : '○ Revoked'}
                </span>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
                {[
                  ['Project', a.project_name],
                  ['License', a.license_type],
                  ['Client', a.client?.name],
                  ['Access End', a.access_end ? new Date(a.access_end).toLocaleDateString() : 'Open'],
                ].map(([k, v]) => (
                  <div key={k} style={{ background:'var(--bg)', padding:'8px 10px', borderRadius:'var(--radius)' }}>
                    <div className="text-muted text-sm">{k}</div>
                    <div style={{ fontWeight:500, fontSize:13 }}>{v}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize:12, color:'var(--muted)', marginBottom:12, padding:'8px 10px', background:'var(--bg)', borderRadius:'var(--radius)' }}>
                <strong>Permitted:</strong> {a.permitted_use}
              </div>

              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-outline btn-sm" onClick={() => nav(`/datasets/${a.dataset?.id}`)}>
                  View Data Card
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => nav('/api-access')}>
                  API Access →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
