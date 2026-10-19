import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Filter, Plus } from 'lucide-react'
import api from '../api/client'

const statusBadge = s => <span className={`badge badge-${s}`}>{s?.replace('_', ' ')}</span>
const typeBadge = t => <span className={`badge badge-${t}`}>{t}</span>

export default function Datasets() {
  const [datasets, setDatasets] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ status: '', language: '', data_type: '' })
  const nav = useNavigate()
  const role = localStorage.getItem('role')

  useEffect(() => { load() }, [filter])

  async function load() {
    setLoading(true)
    try {
      const params = {}
      if (filter.status) params.status = filter.status
      if (filter.language) params.language = filter.language
      if (filter.data_type) params.data_type = filter.data_type
      const { data } = await api.get('/datasets/', { params })
      setDatasets(data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Datasets</h2>
          <p className="text-muted text-sm mt-2">{datasets.length} dataset{datasets.length !== 1 ? 's' : ''} found</p>
        </div>
        {(role === 'admin' || role === 'supplier') && (
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-outline" onClick={() => nav('/datacard/create')}>
              <Plus size={14} /> Create Data Card
            </button>
            <button className="btn btn-primary" onClick={() => nav('/upload')}>
              <Plus size={14} /> Upload Dataset
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom:20, padding:16 }}>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
          <Filter size={14} color="var(--muted)" />
          <select className="form-select" style={{ width:'auto', minWidth:140 }}
            value={filter.status} onChange={e => setFilter(f => ({...f, status: e.target.value}))}>
            <option value="">All Statuses</option>
            <option value="uploaded">Uploaded</option>
            <option value="processing">Processing</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select className="form-select" style={{ width:'auto', minWidth:140 }}
            value={filter.data_type} onChange={e => setFilter(f => ({...f, data_type: e.target.value}))}>
            <option value="">All Types</option>
            <option value="audio">Audio</option>
            <option value="video">Video</option>
            <option value="image">Image</option>
          </select>
          <input className="form-input" style={{ width:'auto', minWidth:180 }} placeholder="Filter by language..."
            value={filter.language} onChange={e => setFilter(f => ({...f, language: e.target.value}))} />
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state"><div className="spinner" style={{margin:'0 auto'}} /></div>
        ) : datasets.length === 0 ? (
          <div className="empty-state">No datasets match your filters.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Language</th>
                  <th>Country</th>
                  <th>Size</th>
                  <th>Status</th>
                  <th>Version</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {datasets.map(ds => (
                  <tr key={ds.id} style={{ cursor:'pointer' }} onClick={() => nav(`/datasets/${ds.id}`)}>
                    <td>
                      <div style={{ fontWeight:500 }}>{ds.name}</div>
                      <div className="text-muted text-sm">{ds.dialect}</div>
                    </td>
                    <td>{typeBadge(ds.data_type)}</td>
                    <td>{ds.language}</td>
                    <td>{ds.country}</td>
                    <td className="text-muted">{ds.file_size_mb > 0 ? `${ds.file_size_mb.toFixed(0)} MB` : '—'}</td>
                    <td>{statusBadge(ds.status)}</td>
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
