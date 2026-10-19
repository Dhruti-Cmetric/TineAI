import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Globe2, Lock, ShieldCheck, Key, Download, ArrowRight,
  FileText, CheckCircle2, AlertCircle, Building2, Calendar, Tag
} from 'lucide-react'
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
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Enterprise Commercial Portal</h2>
          <p className="text-muted text-sm mt-2">
            {role === 'client'
              ? `Welcome, ${name}. Licensed datasets, acoustic corpora & access credentials for your projects.`
              : 'Enterprise client project assignments and licensing agreements'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={() => nav('/api-access')}>
            <Key size={14} />
            <span>Manage API Tokens</span>
          </button>
        </div>
      </div>

      {role === 'client' && (
        <div className="alert alert-info" style={{ marginBottom: 24 }}>
          <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong>Licensed & Compliance Protected:</strong> Your organization has commercial usage rights for the datasets listed below.
            All API calls and dataset downloads are cryptographically authenticated and logged for licensing auditability.
          </div>
        </div>
      )}

      {assignments.length === 0 ? (
        <div className="empty-state">
          <Globe2 size={44} />
          <p style={{ marginTop: 8 }}>No active dataset assignments found for your account.</p>
          <p className="text-sm text-muted">Contact TINE AI Platform Operations to assign African corpora to your project.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
          {assignments.map(a => (
            <div
              key={a.id}
              className="card"
              style={{
                borderTop: '3px solid var(--accent)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, color: 'var(--text)' }}>
                      {a.dataset?.name}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span className="badge badge-audio">{a.dataset?.language}</span>
                      <span className="badge" style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}>
                        {a.dataset?.country}
                      </span>
                      {a.dataset?.dialect && (
                        <span className="badge" style={{ background: '#f1f5f9', color: 'var(--muted)' }}>
                          {a.dataset?.dialect}
                        </span>
                      )}
                    </div>
                  </div>

                  {a.is_active ? (
                    <span className="badge badge-approved">
                      <CheckCircle2 size={12} />
                      <span>Active License</span>
                    </span>
                  ) : (
                    <span className="badge badge-rejected">
                      <AlertCircle size={12} />
                      <span>Revoked</span>
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '14px 0' }}>
                  <div style={{ background: 'var(--surface-raised)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                    <div className="text-muted text-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Building2 size={12} /> Project
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 13, marginTop: 2 }}>{a.project_name}</div>
                  </div>

                  <div style={{ background: 'var(--surface-raised)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                    <div className="text-muted text-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Tag size={12} /> License Tier
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 13, marginTop: 2 }}>{a.license_type}</div>
                  </div>

                  <div style={{ background: 'var(--surface-raised)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                    <div className="text-muted text-sm">Authorized Client</div>
                    <div style={{ fontWeight: 600, fontSize: 13, marginTop: 2 }}>{a.client?.name}</div>
                  </div>

                  <div style={{ background: 'var(--surface-raised)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                    <div className="text-muted text-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={12} /> Expiration
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 13, marginTop: 2 }}>
                      {a.access_end ? new Date(a.access_end).toLocaleDateString() : 'Perpetual Commercial'}
                    </div>
                  </div>
                </div>

                <div style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  marginBottom: 16,
                  padding: '10px 12px',
                  background: 'var(--surface-raised)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)'
                }}>
                  <strong style={{ color: 'var(--text)' }}>Permitted Scope:</strong> {a.permitted_use}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  className="btn btn-outline btn-sm"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => nav(`/datasets/${a.dataset?.id}`)}
                >
                  <FileText size={13} />
                  <span>Inspect Data Card</span>
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => nav('/api-access')}
                >
                  <Key size={13} />
                  <span>API Access</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
