import { useEffect, useState } from 'react'
import { Link2, ShieldOff } from 'lucide-react'
import api from '../api/client'
import toast from 'react-hot-toast'

export default function Assignments() {
  const [assignments, setAssignments] = useState([])
  const [datasets, setDatasets] = useState([])
  const [clients, setClients] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ client_id: '', dataset_id: '', project_name: '', license_type: 'Research', permitted_use: 'AI model training' })

  function load() {
    api.get('/access/assignments').then(r => setAssignments(r.data))
    api.get('/datasets/?status=approved').then(r => setDatasets(r.data))
    api.get('/users/').then(r => setClients(r.data.filter(u => u.role === 'client')))
  }

  useEffect(() => { load() }, [])

  async function assign(e) {
    e.preventDefault()
    try {
      await api.post('/access/assign', { ...form, client_id: +form.client_id, dataset_id: +form.dataset_id })
      toast.success('Dataset assigned!')
      setShowForm(false)
      load()
    } catch(err) {
      toast.error(err.response?.data?.detail || 'Assignment failed')
    }
  }

  async function revoke(id) {
    if (!window.confirm('Revoke this client\'s access? This will be logged in the audit trail.')) return
    try {
      await api.patch(`/access/assignments/${id}/revoke`)
      toast.success('Access revoked and logged')
      load()
    } catch(err) {
      toast.error(err.response?.data?.detail || 'Revoke failed')
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Client Assignments</h2>
          <p className="text-muted text-sm mt-2">Assign approved datasets to client projects</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(s=>!s)}>
          <Link2 size={14} /> New Assignment
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom:20 }}>
          <div className="card-title">Assign Dataset to Client</div>
          <form onSubmit={assign}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Client</label>
                <select className="form-select" value={form.client_id} onChange={e => setForm(f=>({...f,client_id:e.target.value}))} required>
                  <option value="">Select client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Approved Dataset</label>
                <select className="form-select" value={form.dataset_id} onChange={e => setForm(f=>({...f,dataset_id:e.target.value}))} required>
                  <option value="">Select dataset...</option>
                  {datasets.map(d => <option key={d.id} value={d.id}>{d.name} ({d.language})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Project Name</label>
                <input className="form-input" value={form.project_name} onChange={e => setForm(f=>({...f,project_name:e.target.value}))} required />
              </div>
              <div className="form-group">
                <label className="form-label">License Type</label>
                <select className="form-select" value={form.license_type} onChange={e => setForm(f=>({...f,license_type:e.target.value}))}>
                  <option>Research</option>
                  <option>Commercial</option>
                  <option>Non-Commercial</option>
                </select>
              </div>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label className="form-label">Permitted Use</label>
                <input className="form-input" value={form.permitted_use} onChange={e => setForm(f=>({...f,permitted_use:e.target.value}))} />
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-primary" type="submit">Assign Dataset</button>
              <button className="btn btn-outline" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Client</th><th>Dataset</th><th>Project</th><th>License</th><th>Permitted Use</th><th>Status</th><th>Access End</th><th>Control</th></tr>
            </thead>
            <tbody>
              {assignments.map(a => (
                <tr key={a.id}>
                  <td>
                    <div style={{ fontWeight:500 }}>{a.client?.name}</div>
                    <div className="text-muted text-sm">{a.client?.email}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight:500 }}>{a.dataset?.name}</div>
                    <div className="text-muted text-sm">{a.dataset?.language} · {a.dataset?.country}</div>
                  </td>
                  <td>{a.project_name}</td>
                  <td><span className="badge" style={{ background:'var(--accent-light)', color:'var(--accent)' }}>{a.license_type}</span></td>
                  <td className="text-muted" style={{ maxWidth:180, fontSize:12 }}>{a.permitted_use}</td>
                  <td>
                    <span style={{ color: a.is_active ? 'var(--success)' : 'var(--danger)', fontWeight:600, fontSize:13 }}>
                      {a.is_active ? '● Active' : '○ Revoked'}
                    </span>
                  </td>
                  <td className="text-muted">{a.access_end ? new Date(a.access_end).toLocaleDateString() : 'No expiry'}</td>
                  <td>
                    {a.is_active ? (
                      <button className="btn btn-sm" style={{ background:'var(--danger-light)', color:'var(--danger)', border:'1px solid #fca5a5' }} onClick={() => revoke(a.id)}>
                        <ShieldOff size={12} /> Revoke
                      </button>
                    ) : (
                      <span className="text-muted text-sm">Revoked</span>
                    )}
                  </td>
                </tr>
              ))}
              {assignments.length === 0 && <tr><td colSpan={8} style={{ textAlign:'center', color:'var(--muted)', padding:32 }}>No assignments yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
