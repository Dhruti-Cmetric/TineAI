import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload, Database, Clock, CheckCircle, Plus, ArrowRight,
  TrendingUp, Award, FileAudio, FileText, Globe2, ShieldCheck
} from 'lucide-react'
import api from '../api/client'

export default function SupplierDashboard() {
  const [datasets, setDatasets] = useState([])
  const nav = useNavigate()
  const name = localStorage.getItem('name')

  useEffect(() => {
    api.get('/datasets/').then(r => setDatasets(r.data))
  }, [])

  const counts = {
    total: datasets.length,
    uploaded: datasets.filter(d => d.status === 'uploaded').length,
    processing: datasets.filter(d => ['processing', 'annotated', 'under_review'].includes(d.status)).length,
    approved: datasets.filter(d => ['approved', 'available'].includes(d.status)).length,
  }

  const acceptanceRate = counts.total > 0
    ? Math.round((counts.approved / counts.total) * 100)
    : 100

  const statusBadgeClass = {
    uploaded: 'badge-uploaded',
    processing: 'badge-processing',
    annotated: 'badge-under_review',
    under_review: 'badge-under_review',
    approved: 'badge-approved',
    available: 'badge-approved',
    rejected: 'badge-rejected'
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Data Supplier & Vendor Portal</h2>
          <p className="text-muted text-sm mt-2">
            Welcome, {name} — Manage your native African speech and text contributions, monitor pipeline progress, and track licensing eligibility.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" onClick={() => nav('/upload')}>
            <Upload size={14} />
            <span>Upload Corpus</span>
          </button>
          <button className="btn btn-primary" onClick={() => nav('/datacard/create')}>
            <Plus size={14} />
            <span>Register Data Card</span>
          </button>
        </div>
      </div>

      {/* Supplier KPI Grid */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        {[
          { label: 'Contributed Datasets', value: counts.total, icon: Database, color: '#2563eb', bg: '#eff6ff' },
          { label: 'Staged for Processing', value: counts.uploaded, icon: Clock, color: '#d97706', bg: '#fffbeb' },
          { label: 'In QA & Validation', value: counts.processing, icon: TrendingUp, color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'Approved for Marketplace', value: counts.approved, icon: CheckCircle, color: '#059669', bg: '#ecfdf5' },
          { label: 'QA Acceptance Rate', value: `${acceptanceRate}%`, icon: Award, color: '#0891b2', bg: '#ecfeff' },
        ].map(c => (
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

      {/* Datasets Table */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>
            <FileAudio size={18} color="var(--accent)" />
            <span>My Language Assets & Submissions</span>
          </div>
          <span className="text-sm text-muted">Showing {datasets.length} registered assets</span>
        </div>

        {datasets.length === 0 ? (
          <div className="empty-state">
            <Upload size={40} />
            <p style={{ marginTop: 10, fontWeight: 600, color: 'var(--text)' }}>No contributions uploaded yet</p>
            <p className="text-sm text-muted">Upload raw audio or registered text datasets to begin automated AI enrichment.</p>
            <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => nav('/upload')}>
              <Upload size={14} />
              <span>Upload First Dataset</span>
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Dataset Name</th>
                  <th>Language</th>
                  <th>Country / Region</th>
                  <th>Type</th>
                  <th>Pipeline Status</th>
                  <th>Version</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {datasets.map(ds => (
                  <tr key={ds.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/datasets/${ds.id}`)}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{ds.name}</div>
                      {ds.dialect && <div className="text-muted text-sm">{ds.dialect}</div>}
                    </td>
                    <td>
                      <span className="badge badge-text">{ds.language}</span>
                    </td>
                    <td>{ds.country}</td>
                    <td>
                      <span className={`badge badge-${ds.data_type}`}>
                        {ds.data_type === 'audio' ? <FileAudio size={12} /> : <FileText size={12} />}
                        <span>{ds.data_type}</span>
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${statusBadgeClass[ds.status] || 'badge-restricted'}`}>
                        {ds.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
                        v{ds.version}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="btn btn-outline btn-sm">
                        <span>Details</span>
                        <ArrowRight size={12} />
                      </span>
                    </td>
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
