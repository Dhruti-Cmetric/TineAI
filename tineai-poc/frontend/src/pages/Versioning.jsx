import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, CheckCircle } from 'lucide-react'
import api from '../api/client'
import toast from 'react-hot-toast'

export default function Versioning() {
  const { id } = useParams()
  const nav = useNavigate()
  const [ds, setDs] = useState(null)
  const [versions, setVersions] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ version_number: '', change_notes: '', file_count: 0 })

  useEffect(() => { load() }, [id])

  async function load() {
    const [d, v] = await Promise.all([api.get(`/datasets/${id}`), api.get(`/datasets/${id}/versions`)])
    setDs(d.data); setVersions(v.data)
  }

  async function createVersion(e) {
    e.preventDefault()
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      await api.post(`/datasets/${id}/versions`, fd)
      toast.success(`Version ${form.version_number} created`)
      setShowForm(false)
      setForm({ version_number: '', change_notes: '', file_count: 0 })
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed')
    }
  }

  const statusColor = { approved:'var(--success)', pending:'var(--warning)', rejected:'var(--danger)' }

  return (
    <div>
      <button className="btn btn-ghost" style={{ marginBottom:16 }} onClick={() => nav(`/datasets/${id}`)}>
        <ArrowLeft size={14}/> Back to Dataset
      </button>

      <div className="page-header">
        <div>
          <h2>Dataset Versions</h2>
          {ds && <p className="text-muted text-sm mt-2">{ds.name} — Version history and management</p>}
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(s=>!s)}>
          <Plus size={14}/> Create New Version
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom:20 }}>
          <div className="card-title">New Version</div>
          <form onSubmit={createVersion}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Version Number</label>
                <input className="form-input" value={form.version_number} onChange={e => setForm(f=>({...f,version_number:e.target.value}))} placeholder="e.g. v2" required />
              </div>
              <div className="form-group">
                <label className="form-label">File Count</label>
                <input className="form-input" type="number" value={form.file_count} onChange={e => setForm(f=>({...f,file_count:+e.target.value}))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Change Notes</label>
              <textarea className="form-textarea" value={form.change_notes} onChange={e => setForm(f=>({...f,change_notes:e.target.value}))}
                placeholder="Describe what changed in this version — new files, re-annotation, quality improvements..." />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-primary" type="submit">Create Version</button>
              <button className="btn btn-outline" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Important note about versioning */}
      <div className="alert alert-info" style={{ marginBottom:20 }}>
        Creating a new version does NOT change existing client assignments. Clients assigned to v1 remain on v1 until an explicit new assignment is made.
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {versions.length === 0 ? (
          <div className="card" style={{ textAlign:'center', padding:32 }}>
            <p className="text-muted">No versions created yet. Create the first version after the dataset is approved.</p>
          </div>
        ) : versions.map((v, idx) => (
          <div key={v.id} className="card" style={{ borderLeft:`4px solid ${statusColor[v.status]||'var(--border)'}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
                  <span style={{ fontSize:22, fontWeight:800 }}>{v.version_number}</span>
                  <span style={{ background:(statusColor[v.status]||'#64748b')+'20', color:statusColor[v.status]||'#64748b',
                    padding:'2px 10px', borderRadius:20, fontSize:12, fontWeight:600, textTransform:'capitalize' }}>
                    {v.status}
                  </span>
                  {idx === 0 && <span style={{ background:'#fef3c7', color:'#d97706', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600 }}>LATEST</span>}
                </div>
                <div style={{ fontSize:13, color:'#374151', marginBottom:4 }}>{v.change_notes}</div>
                <div className="text-muted text-sm">{v.file_count} files · Created by {v.created_by} · {new Date(v.created_at).toLocaleDateString()}</div>
              </div>
              {v.status === 'approved' && <CheckCircle size={20} color="var(--success)"/>}
            </div>
          </div>
        ))}
      </div>

      {/* Show current dataset version for context */}
      {ds && (
        <div className="card" style={{ marginTop:20, background:'var(--bg)', border:'1px dashed var(--border)' }}>
          <div className="text-muted text-sm">Current dataset record version: <strong>v{ds.version}</strong> | Status: <strong>{ds.status}</strong></div>
        </div>
      )}
    </div>
  )
}
