import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Database, Users, CheckCircle, Clock, Upload, Globe2, Activity,
  Zap, ArrowRight, ShieldCheck, MapPin, Languages, Layers, Cpu
} from 'lucide-react'
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
    { label: 'Total Datasets', value: stats?.datasets_total ?? '—', icon: Database, color: '#2563eb', bg: '#eff6ff' },
    { label: 'Production Approved', value: stats?.datasets_approved ?? '—', icon: CheckCircle, color: '#059669', bg: '#ecfdf5' },
    { label: 'Under QA Review', value: stats?.datasets_pending ?? '—', icon: Clock, color: '#7c3aed', bg: '#f5f3ff' },
    { label: 'Ingested & Staged', value: stats?.datasets_uploaded ?? '—', icon: Upload, color: '#d97706', bg: '#fffbeb' },
    ...(userStats ? [
      { label: 'Verified Suppliers', value: userStats.suppliers, icon: Globe2, color: '#0891b2', bg: '#ecfeff' },
      { label: 'Enterprise Clients', value: userStats.clients, icon: Users, color: '#db2777', bg: '#fdf2f8' },
    ] : []),
  ]

  const supportedRegions = [
    { country: 'Nigeria', languages: 'Yoruba, Hausa, Igbo, Nigerian Pidgin' },
    { country: 'Kenya', languages: 'Swahili, Sheng, Kikuyu' },
    { country: 'Ethiopia', languages: 'Amharic, Oromo, Tigrinya' },
    { country: 'Cameroon', languages: 'Cameroonian French, Ewondo' },
    { country: 'South Africa', languages: 'isiZulu, isiXhosa, Afrikaans' },
    { country: 'Pan-African', languages: '20+ Sub-Saharan Dialects' }
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Enterprise Control Center</h2>
          <p className="text-muted text-sm mt-2">
            Pan-African AI Data Platform — Ingestion, Quality Auditing, and Commercial Licensing
          </p>
        </div>
      </div>

      {/* Regional Coverage Banner */}
      <div
        className="card"
        style={{
          marginBottom: 24,
          background: 'linear-gradient(135deg, #0b1329 0%, #1e3a8a 100%)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.08)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: 'rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Globe2 size={28} color="#60a5fa" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700 }}>Pan-African High-Accuracy Language Matrix</h3>
              <span className="badge" style={{ background: 'rgba(5, 150, 105, 0.25)', color: '#34d399', border: 'none' }}>
                Active Multi-Lingual Cluster
              </span>
            </div>
            <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>
              Native speech corpora, audio phonetics, and NLP datasets covering Flores-200 African benchmarks with guaranteed acoustic quality.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {supportedRegions.map(r => (
                <span
                  key={r.country}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 11.5,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  <MapPin size={12} color="#93c5fd" />
                  <strong style={{ color: '#f1f5f9' }}>{r.country}</strong>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="stat-grid">
        {statCards.map(c => (
          <div className="stat-card" key={c.label}>
            <div className="stat-icon" style={{ background: c.bg, color: c.color }}>
              <c.icon size={22} />
            </div>
            <div>
              <div className="stat-value">{c.value}</div>
              <div className="stat-label">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* AI Pipeline Live Status */}
      {pipeStats && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={16} color="var(--accent)" />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Neural Pipeline Throughput</span>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => nav('/pipeline')}>
              <span>View Monitor</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {[
              { label: 'Total Ingested Jobs', value: pipeStats.jobs.total, color: '#2563eb' },
              { label: 'Processing (GPU/CPU)', value: pipeStats.jobs.running, color: '#d97706' },
              { label: 'Pipeline Completed', value: pipeStats.jobs.completed, color: '#059669' },
              { label: 'Exceptions Handled', value: pipeStats.jobs.failed, color: '#dc2626' },
            ].map(c => (
              <div key={c.label} style={{ background: 'var(--surface-raised)', padding: '12px 14px', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: c.color }}>{c.value}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600, marginTop: 2 }}>{c.label}</div>
              </div>
            ))}
          </div>

          {pipeStats.by_task_type && Object.keys(pipeStats.by_task_type).length > 0 && (
            <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(pipeStats.by_task_type).map(([tt, cnt]) => (
                <span key={tt} className="badge badge-client">
                  <Cpu size={12} />
                  <span>{tt.replace(/_/g, ' ')}: {cnt}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Workflow & Governance */}
      <div style={{ display: 'grid', gridTemplateColumns: role() === 'admin' ? '1fr 1fr' : '1fr', gap: 20 }}>
        <div className="card">
          <div className="card-title">
            <ShieldCheck size={18} color="var(--success)" />
            <span>Dataset Verification & Lifecycle</span>
          </div>
          <div className="workflow-bar">
            {['1. Uploaded', '2. AI Enrich', '3. QA Review', '4. Enterprise Approved'].map((s) => (
              <div key={s} className="wf-step done" style={{ fontSize: 11 }}>{s}</div>
            ))}
          </div>
          <p className="text-muted text-sm">
            Strict human-in-the-loop governance: no acoustic corpus or translation dataset is made accessible without automated QA and reviewer approval.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn btn-outline btn-sm" onClick={() => nav('/datasets')}>Datasets Catalog</button>
            <button className="btn btn-outline btn-sm" onClick={() => nav('/models')}>Model Registry</button>
            <button className="btn btn-outline btn-sm" onClick={() => nav('/finetuning')}>Fine-tuning</button>
          </div>
        </div>

        {role() === 'admin' && (
          <div className="card">
            <div className="card-title">
              <Activity size={18} color="var(--accent)" />
              <span>Real-Time Audit Trail</span>
            </div>
            {logs.length === 0 ? (
              <div className="text-muted text-sm">No activity recorded yet.</div>
            ) : (
              logs.map(l => (
                <div key={l.id} style={{ borderBottom: '1px solid var(--border-subtle)', padding: '10px 0', fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>{l.action}</span>
                    <span className="text-muted text-sm">{new Date(l.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-muted text-sm">{l.detail}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
