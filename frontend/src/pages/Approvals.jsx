import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle, Eye, Clock, Zap } from 'lucide-react'
import api from '../api/client'
import toast from 'react-hot-toast'

export default function Approvals() {
  const [datasets, setDatasets] = useState([])
  const [loading, setLoading] = useState(true)
  const [rejectId, setRejectId] = useState(null)
  const [reason, setReason] = useState('')
  const nav = useNavigate()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      // Fetch uploaded, processing and under_review datasets
      const [r1, r2, r3] = await Promise.all([
        api.get('/datasets/?status=uploaded'),
        api.get('/datasets/?status=processing'),
        api.get('/datasets/?status=under_review'),
      ])
      setDatasets([...r3.data, ...r2.data, ...r1.data])
    } finally { setLoading(false) }
  }

  async function advance(id, newStatus, rejectReason = '') {
    await api.patch(`/datasets/${id}/status?new_status=${newStatus}${rejectReason ? `&reason=${encodeURIComponent(rejectReason)}` : ''}`)
    toast.success(`Dataset ${newStatus}`)
    setRejectId(null)
    setReason('')
    load()
  }

  async function enrich(id) {
    try {
      await api.patch(`/datasets/${id}/enrich`)
      toast.success('AI enrichment applied!')
      load()
    } catch { toast.error('Enrichment failed') }
  }

  const statusOrder = { under_review: 0, processing: 1, uploaded: 2 }
  const sorted = [...datasets].sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9))

  const statusMeta = {
    uploaded:     { label: 'Awaiting Processing', color: '#1a56db', bg: '#ebf2ff', next: 'processing', nextLabel: 'Start Processing' },
    processing:   { label: 'In Processing',       color: '#d97706', bg: '#fef3c7', next: null,         nextLabel: '' },
    under_review: { label: 'Pending Approval',    color: '#7c3aed', bg: '#ede9fe', next: 'approved',   nextLabel: 'Approve' },
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Approvals Queue</h2>
          <p className="text-muted text-sm mt-2">
            {sorted.length} dataset{sorted.length !== 1 ? 's' : ''} requiring attention
          </p>
        </div>
      </div>

      {sorted.length === 0 && !loading && (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <CheckCircle size={40} color="var(--success)" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Queue is clear</div>
          <div className="text-muted text-sm">All datasets have been reviewed.</div>
        </div>
      )}

      {loading && <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {sorted.map(ds => {
          const meta = statusMeta[ds.status] || {}
          return (
            <div key={ds.id} className="card" style={{ borderLeft: `4px solid ${meta.color || '#e2e8f0'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                {/* Left: info */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{ds.name}</span>
                    <span className={`badge badge-${ds.data_type}`}>{ds.data_type}</span>
                    <span style={{ background: meta.bg, color: meta.color, padding: '2px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 600 }}>
                      {meta.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 20, fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
                    <span>🌍 {ds.language}</span>
                    <span>📍 {ds.country}</span>
                    {ds.dialect && <span>🗣 {ds.dialect}</span>}
                    <span>v{ds.version}</span>
                  </div>
                  {ds.description && (
                    <div style={{ fontSize: 13, color: '#374151', marginBottom: 8, maxWidth: 580 }}>
                      {ds.description.slice(0, 120)}{ds.description.length > 120 ? '...' : ''}
                    </div>
                  )}
                  {ds.transcription_text && (
                    <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#374151', maxWidth: 580, fontStyle: 'italic' }}>
                      "{ds.transcription_text.slice(0, 140)}..."
                    </div>
                  )}
                  {ds.quality_score && (
                    <div style={{ marginTop: 8, fontSize: 12 }}>
                      Quality Score: <strong style={{ color: 'var(--success)' }}>{(ds.quality_score * 100).toFixed(0)}%</strong>
                    </div>
                  )}
                </div>

                {/* Right: actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 160, flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => nav(`/datasets/${ds.id}`)}>
                    <Eye size={13} /> View Data Card
                  </button>

                  {ds.status === 'uploaded' && (
                    <button className="btn btn-outline btn-sm" onClick={() => advance(ds.id, 'processing')}>
                      <Clock size={13} /> Start Processing
                    </button>
                  )}

                  {ds.status === 'processing' && (
                    <button className="btn btn-primary btn-sm" onClick={() => enrich(ds.id)}>
                      <Zap size={13} /> Run AI Enrichment
                    </button>
                  )}

                  {ds.status === 'under_review' && (<>
                    <button className="btn btn-success btn-sm" onClick={() => advance(ds.id, 'approved')}>
                      <CheckCircle size={13} /> Approve
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => setRejectId(ds.id)}>
                      <XCircle size={13} /> Reject
                    </button>
                  </>)}
                </div>
              </div>

              {/* Reject reason inline */}
              {rejectId === ds.id && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <label className="form-label">Rejection Reason</label>
                  <textarea className="form-textarea" style={{ minHeight: 60, marginBottom: 8 }}
                    placeholder="Explain why this dataset is being rejected..."
                    value={reason} onChange={e => setReason(e.target.value)} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-danger btn-sm" onClick={() => advance(ds.id, 'rejected', reason)}>
                      Confirm Rejection
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={() => { setRejectId(null); setReason('') }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
