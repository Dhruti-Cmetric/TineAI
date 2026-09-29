import { useEffect, useState } from 'react'
import { Plus, Briefcase } from 'lucide-react'
import api from '../api/client'
import toast from 'react-hot-toast'

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [licenses, setLicenses] = useState([])
  const [clients, setClients] = useState([])
  const [showProjForm, setShowProjForm] = useState(false)
  const [showLicForm, setShowLicForm] = useState(false)
  const [projForm, setProjForm] = useState({ name: '', description: '', client_id: '' })
  const [licForm, setLicForm] = useState({
    name: '', license_type: 'Research', permitted_use: '', commercial_use: false,
    geographic_restriction: '', exclusivity: false, redistribution_allowed: false,
    model_restriction: '', duration_days: 180, notes: ''
  })
  const role = localStorage.getItem('role')

  useEffect(() => {
    api.get('/projects/').then(r => setProjects(r.data))
    if (role === 'admin') {
      api.get('/projects/licenses').then(r => setLicenses(r.data))
      api.get('/users/').then(r => setClients(r.data.filter(u => u.role === 'client')))
    }
  }, [])

  async function createProject(e) {
    e.preventDefault()
    try {
      await api.post('/projects/', { ...projForm, client_id: +projForm.client_id })
      toast.success('Project created')
      setShowProjForm(false)
      api.get('/projects/').then(r => setProjects(r.data))
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
  }

  async function createLicense(e) {
    e.preventDefault()
    try {
      await api.post('/projects/licenses', licForm)
      toast.success('License created')
      setShowLicForm(false)
      api.get('/projects/licenses').then(r => setLicenses(r.data))
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
  }

  return (
    <div>
      <div className="page-header">
        <div><h2>Projects & Licenses</h2><p className="text-muted text-sm mt-2">Manage client projects and license configurations</p></div>
        {role === 'admin' && (
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-outline" onClick={() => setShowLicForm(s=>!s)}><Plus size={14}/> New License</button>
            <button className="btn btn-primary" onClick={() => setShowProjForm(s=>!s)}><Plus size={14}/> New Project</button>
          </div>
        )}
      </div>

      {showProjForm && (
        <div className="card" style={{ marginBottom:20 }}>
          <div className="card-title">New Client Project</div>
          <form onSubmit={createProject}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Project Name</label>
                <input className="form-input" value={projForm.name} onChange={e => setProjForm(f=>({...f,name:e.target.value}))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Client</label>
                <select className="form-select" value={projForm.client_id} onChange={e => setProjForm(f=>({...f,client_id:e.target.value}))} required>
                  <option value="">Select client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label className="form-label">Description</label>
                <input className="form-input" value={projForm.description} onChange={e => setProjForm(f=>({...f,description:e.target.value}))} />
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-primary" type="submit">Create Project</button>
              <button className="btn btn-outline" type="button" onClick={() => setShowProjForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {showLicForm && (
        <div className="card" style={{ marginBottom:20 }}>
          <div className="card-title">New License Configuration (§9.12)</div>
          <form onSubmit={createLicense}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">License Name</label>
                <input className="form-input" value={licForm.name} onChange={e => setLicForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Commercial AI Training — No Redistribution" required />
              </div>
              <div className="form-group">
                <label className="form-label">License Type</label>
                <select className="form-select" value={licForm.license_type} onChange={e => setLicForm(f=>({...f,license_type:e.target.value}))}>
                  <option>Research</option><option>Commercial</option><option>Non-Commercial</option>
                </select>
              </div>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label className="form-label">Permitted Use</label>
                <input className="form-input" value={licForm.permitted_use} onChange={e => setLicForm(f=>({...f,permitted_use:e.target.value}))} placeholder="AI model training, fine-tuning..." />
              </div>
              <div className="form-group">
                <label className="form-label">Geographic Restriction</label>
                <input className="form-input" value={licForm.geographic_restriction} onChange={e => setLicForm(f=>({...f,geographic_restriction:e.target.value}))} placeholder="Global, or specific regions..." />
              </div>
              <div className="form-group">
                <label className="form-label">Duration (days)</label>
                <input className="form-input" type="number" value={licForm.duration_days} onChange={e => setLicForm(f=>({...f,duration_days:+e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Model Restriction</label>
                <input className="form-input" value={licForm.model_restriction} onChange={e => setLicForm(f=>({...f,model_restriction:e.target.value}))} placeholder="Internal use only, no API resale..." />
              </div>
              <div className="form-group">
                <label className="form-label">Flags</label>
                <div style={{ display:'flex', gap:16, marginTop:4 }}>
                  {[['Commercial Use', 'commercial_use'],['Exclusivity','exclusivity'],['Redistribution OK','redistribution_allowed']].map(([l,k]) => (
                    <label key={k} style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer' }}>
                      <input type="checkbox" checked={licForm[k]} onChange={e => setLicForm(f=>({...f,[k]:e.target.checked}))} />
                      {l}
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" value={licForm.notes} onChange={e => setLicForm(f=>({...f,notes:e.target.value}))} style={{ minHeight:50 }} />
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-primary" type="submit">Create License</button>
              <button className="btn btn-outline" type="button" onClick={() => setShowLicForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns: role==='admin' ? '1fr 1fr' : '1fr', gap:20 }}>
        {/* Projects */}
        <div>
          <h3 style={{ fontSize:15, fontWeight:700, marginBottom:12 }}>Client Projects</h3>
          {projects.length === 0 ? <div className="card"><div className="text-muted text-sm">No projects yet.</div></div> :
            projects.map(p => (
              <div key={p.id} className="card" style={{ marginBottom:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                      <Briefcase size={14} color="var(--accent)"/>
                      <span style={{ fontWeight:600 }}>{p.name}</span>
                    </div>
                    <div className="text-muted text-sm">{p.description}</div>
                    <div style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}>Client: {p.client_name}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontWeight:700, fontSize:18 }}>{p.dataset_count}</div>
                    <div className="text-muted text-sm">datasets</div>
                  </div>
                </div>
              </div>
            ))
          }
        </div>

        {/* Licenses */}
        {role === 'admin' && (
          <div>
            <h3 style={{ fontSize:15, fontWeight:700, marginBottom:12 }}>License Configurations</h3>
            {licenses.length === 0 ? <div className="card"><div className="text-muted text-sm">No licenses yet.</div></div> :
              licenses.map(l => (
                <div key={l.id} className="card" style={{ marginBottom:12 }}>
                  <div style={{ fontWeight:600, marginBottom:4 }}>{l.name}</div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:6 }}>
                    <span className="badge" style={{ background:'var(--accent-light)', color:'var(--accent)' }}>{l.license_type}</span>
                    {l.commercial_use && <span className="badge" style={{ background:'#d1fae5', color:'#065f46' }}>Commercial</span>}
                    {l.exclusivity && <span className="badge" style={{ background:'#fce7f3', color:'#9d174d' }}>Exclusive</span>}
                    {!l.redistribution_allowed && <span className="badge" style={{ background:'#fee2e2', color:'#991b1b' }}>No Redistribution</span>}
                  </div>
                  <div style={{ fontSize:12, color:'var(--muted)' }}>
                    {l.duration_days && `${l.duration_days} days`}
                    {l.geographic_restriction && ` · ${l.geographic_restriction}`}
                  </div>
                  {l.permitted_use && <div className="text-muted text-sm" style={{ marginTop:4 }}>{l.permitted_use}</div>}
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  )
}
