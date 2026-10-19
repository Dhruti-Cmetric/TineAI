import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Database, Users, CheckCircle, Clock, Upload, Globe2, Activity, Zap, XCircle, PlayCircle } from 'lucide-react'
import api from '../api/client'

const role = () => localStorage.getItem('role')

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [userStats, setUserStats] = useState(null)
  const [pipeStats, setPipeStats] = useState(null)
  const [logs, setLogs] = useState([])
  const nav = useNavigate()

  useEffect(() => {
    api.get('/audit/stats').then(r => setStats(r.data)).catch(() => {})
    api.get('/pipeline/stats').then(r => setPipeStats(r.data)).catch(() => {})
    if (role() === 'admin') {
      api.get('/users/stats').then(r => setUserStats(r.data)).catch(() => {})
      api.get('/audit/?limit=5').then(r => setLogs(r.data)).catch(() => {})
    }
  }, [])

  const statCards = [
    { label: 'Total Datasets', value: stats?.datasets_total ?? '—', icon: Database, color: '#1a56db', bg: '#ebf2ff' },
    { label: 'Approved', value: stats?.datasets_approved ?? '—', icon: CheckCircle, color: '#059669', bg: '#d1fae5' },
    { label: 'Under Review', value: stats?.datasets_pending ?? '—', icon: Clock, color: '#7c3aed', bg: '#ede9fe' },
    { label: 'Uploaded', value: stats?.datasets_uploaded ?? '—', icon: Upload, color: '#d97706', bg: '#fef3c7' },
    ...(userStats ? [
      { label: 'Suppliers', value: userStats.suppliers, icon: Globe2, color: '#0891b2', bg: '#e0f2fe' },
      { label: 'Clients', value: userStats.clients, icon: Users, color: '#be185d', bg: '#fce7f3' },
    ] : []),
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Platform Overview</h2>
          <p className="text-muted text-sm mt-2">TINE AI — African Data Platform Control Center</p>
        </div>
      </div>

      {/* Africa map illustration */}
      <div className="card" style={{ marginBottom:24, background:'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)', color:'#fff', border:'none' }}>
        <div style={{ display:'flex', alignItems:'center', gap:20 }}>
          <div style={{ fontSize:56 }}>🌍</div>
          <div>
            <h3 style={{ fontSize:18, fontWeight:700, marginBottom:6 }}>African Language & Cultural Datasets</h3>
            <p style={{ color:'#94a3b8', fontSize:13, lineHeight:1.7 }}>
              Yoruba · Swahili · Amharic · Hausa · Zulu · Cameroonian French · and more African languages, dialects & regional accents
            </p>
            <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
              {['🇳🇬 Nigeria', '🇰🇪 Kenya', '🇪🇹 Ethiopia', '🇨🇲 Cameroon', '🇿🇦 South Africa', '🌍 20+ Countries'].map(c => (
                <span key={c} style={{ background:'rgba(255,255,255,0.1)', padding:'3px 10px', borderRadius:20, fontSize:12 }}>{c}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="stat-grid">
        {statCards.map(c => (
          <div className="stat-card" key={c.label}>
            <div className="stat-icon" style={{ background: c.bg, color: c.color }}>
              <c.icon size={20} />
            </div>
            <div>
              <div className="stat-value">{c.value}</div>
              <div className="stat-label">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* pipeline stats */}
      {pipeStats && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <Zap size={15} color="var(--accent)" />
            <span style={{ fontWeight:700 }}>AI Pipeline Stats</span>
            <button className="btn btn-ghost btn-sm" style={{ marginLeft:'auto', fontSize:12 }} onClick={() => nav('/pipeline')}>
              Monitor →
            </button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
            {[
              { label:'Total Jobs', value: pipeStats.jobs.total, color:'#3b82f6' },
              { label:'Running', value: pipeStats.jobs.running, color:'#f59e0b' },
              { label:'Completed', value: pipeStats.jobs.completed, color:'#10b981' },
              { label:'Failed', value: pipeStats.jobs.failed, color:'#ef4444' },
            ].map(c => (
              <div key={c.label} style={{ background:'var(--bg)', padding:'10px 12px', borderRadius:8, textAlign:'center' }}>
                <div style={{ fontSize:22, fontWeight:800, color:c.color }}>{c.value}</div>
                <div style={{ fontSize:11, color:'var(--muted)' }}>{c.label}</div>
              </div>
            ))}
          </div>
          {pipeStats.by_task_type && Object.keys(pipeStats.by_task_type).length > 0 && (
            <div style={{ marginTop:10, display:'flex', flexWrap:'wrap', gap:6 }}>
              {Object.entries(pipeStats.by_task_type).map(([tt, cnt]) => (
                <span key={tt} style={{ fontSize:11, padding:'2px 9px', borderRadius:10, background:'var(--accent-light)', color:'var(--accent)', fontWeight:600 }}>
                  {tt.replace(/_/g,' ')}: {cnt}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns: role() === 'admin' ? '1fr 1fr' : '1fr', gap:20 }}>
        <div className="card">
          <div className="card-title">Dataset Lifecycle</div>
          <div className="workflow-bar">
            {['Uploaded', 'Processing', 'Review', 'Approved'].map((s) => (
              <div key={s} className="wf-step done" style={{ fontSize:11 }}>{s}</div>
            ))}
          </div>
          <p className="text-muted text-sm">TINE AI controls every stage — no dataset reaches a client without final approval.</p>
          <div style={{ display:'flex', gap:8, marginTop:12 }}>
            <button className="btn btn-outline btn-sm" onClick={() => nav('/datasets')}>Datasets →</button>
            <button className="btn btn-outline btn-sm" onClick={() => nav('/models')}>Model Registry →</button>
            <button className="btn btn-outline btn-sm" onClick={() => nav('/finetuning')}>Fine-tuning →</button>
          </div>
        </div>

        {role() === 'admin' && (
          <div className="card">
            <div className="card-title flex items-center gap-2"><Activity size={16} /> Recent Activity</div>
            {logs.length === 0 ? <div className="text-muted text-sm">No activity yet.</div> : logs.map(l => (
              <div key={l.id} style={{ borderBottom:'1px solid var(--border)', padding:'8px 0', fontSize:13 }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontWeight:500 }}>{l.action}</span>
                  <span className="text-muted text-sm">{new Date(l.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="text-muted text-sm">{l.detail}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
