import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Database, Clock, CheckCircle, Plus } from 'lucide-react'
import api from '../api/client'

export default function SupplierDashboard() {
  const [datasets, setDatasets] = useState([])
  const nav = useNavigate()
  const name = localStorage.getItem('name')

  useEffect(() => { api.get('/datasets/').then(r => setDatasets(r.data)) }, [])

  const counts = {
    total: datasets.length,
    uploaded: datasets.filter(d => d.status === 'uploaded').length,
    processing: datasets.filter(d => ['processing','annotated','under_review'].includes(d.status)).length,
    approved: datasets.filter(d => ['approved','available'].includes(d.status)).length,
  }

  const statusColor = { uploaded:'#1a56db', processing:'#d97706', annotated:'#7c3aed',
    under_review:'#7c3aed', approved:'#059669', available:'#059669', rejected:'#dc2626' }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Supplier Dashboard</h2>
          <p className="text-muted text-sm mt-2">Welcome, {name} — manage your datasets and track processing status</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-outline" onClick={() => nav('/upload')}><Upload size={14}/> Upload Data</button>
          <button className="btn btn-primary" onClick={() => nav('/datacard/create')}><Plus size={14}/> Create Data Card</button>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom:24 }}>
        {[
          { label:'My Datasets', value:counts.total, icon:Database, color:'#1a56db', bg:'#ebf2ff' },
          { label:'Awaiting Processing', value:counts.uploaded, icon:Clock, color:'#d97706', bg:'#fef3c7' },
          { label:'In Review', value:counts.processing, icon:Clock, color:'#7c3aed', bg:'#ede9fe' },
          { label:'Approved', value:counts.approved, icon:CheckCircle, color:'#059669', bg:'#d1fae5' },
        ].map(c => (
          <div className="stat-card" key={c.label}>
            <div className="stat-icon" style={{ background:c.bg, color:c.color }}><c.icon size={20}/></div>
            <div><div className="stat-value">{c.value}</div><div className="stat-label">{c.label}</div></div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">My Datasets</div>
        {datasets.length === 0 ? (
          <div className="empty-state">
            <Upload size={32} />
            <p style={{ marginTop:8 }}>No datasets yet. Upload your first dataset to get started.</p>
            <button className="btn btn-primary" style={{ marginTop:12 }} onClick={() => nav('/upload')}>Upload Dataset</button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Language</th><th>Country</th><th>Type</th><th>Status</th><th>Version</th><th></th></tr></thead>
              <tbody>
                {datasets.map(ds => (
                  <tr key={ds.id} style={{ cursor:'pointer' }} onClick={() => nav(`/datasets/${ds.id}`)}>
                    <td><div style={{ fontWeight:500 }}>{ds.name}</div><div className="text-muted text-sm">{ds.dialect}</div></td>
                    <td>{ds.language}</td>
                    <td>{ds.country}</td>
                    <td><span className={`badge badge-${ds.data_type}`}>{ds.data_type}</span></td>
                    <td>
                      <span style={{ background:(statusColor[ds.status]||'#64748b')+'20', color:statusColor[ds.status]||'#64748b',
                        padding:'2px 10px', borderRadius:20, fontSize:11.5, fontWeight:600 }}>
                        {ds.status.replace('_',' ')}
                      </span>
                    </td>
                    <td className="text-muted">v{ds.version}</td>
                    <td><span className="btn btn-ghost btn-sm">View →</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
