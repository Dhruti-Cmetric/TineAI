import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle, Zap, ArrowLeft, FileAudio, FileVideo, Image, Cpu, Star, GitBranch } from 'lucide-react'
import api from '../api/client'
import toast from 'react-hot-toast'

const statusBadge = s => <span className={`badge badge-${s}`}>{s?.replace('_', ' ')}</span>
const workflow = ['uploaded', 'processing', 'under_review', 'approved']

export default function DatasetDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [ds, setDs] = useState(null)
  const [loading, setLoading] = useState(true)
  const [enriching, setEnriching] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState('')
  const role = localStorage.getItem('role')

  useEffect(() => { loadDs() }, [id])

  async function loadDs() {
    try {
      const { data } = await api.get(`/datasets/${id}`)
      setDs(data)
    } finally { setLoading(false) }
  }

  async function setStatus(newStatus, rejectReason = '') {
    await api.patch(`/datasets/${id}/status?new_status=${newStatus}${rejectReason ? `&reason=${encodeURIComponent(rejectReason)}` : ''}`)
    toast.success(`Status updated to ${newStatus}`)
    loadDs()
  }

  async function runEnrich() {
    setEnriching(true)
    try {
      await api.patch(`/datasets/${id}/enrich`)
      toast.success('AI enrichment complete!')
      loadDs()
    } finally { setEnriching(false) }
  }

  if (loading) return <div className="empty-state"><div className="spinner" style={{margin:'0 auto'}} /></div>
  if (!ds) return <div className="empty-state">Dataset not found.</div>

  const wfIdx = workflow.indexOf(ds.status)
  const TypeIcon = ds.data_type === 'audio' ? FileAudio : ds.data_type === 'video' ? FileVideo : Image

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        <button className="btn btn-ghost" onClick={() => nav('/datasets')}><ArrowLeft size={14} /> Back</button>
        <button className="btn btn-outline btn-sm" onClick={() => nav(`/datasets/${id}/processing`)}><Cpu size={13}/> Processing</button>
        <button className="btn btn-outline btn-sm" onClick={() => nav(`/datasets/${id}/review`)}><Star size={13}/> Review</button>
        <button className="btn btn-outline btn-sm" onClick={() => nav(`/datasets/${id}/versions`)}><GitBranch size={13}/> Versions</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:20 }}>
        {/* Main card */}
        <div>
          <div className="card" style={{ marginBottom:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                  <TypeIcon size={20} color="var(--accent)" />
                  <h2 style={{ fontSize:20, fontWeight:700 }}>{ds.name}</h2>
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {statusBadge(ds.status)}
                  <span className={`badge badge-${ds.data_type}`}>{ds.data_type}</span>
                  <span className="badge" style={{ background:'#f1f5f9', color:'var(--muted)' }}>v{ds.version}</span>
                </div>
              </div>
              {ds.quality_score && (
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:28, fontWeight:700, color:'var(--success)' }}>{(ds.quality_score * 100).toFixed(0)}%</div>
                  <div className="text-muted text-sm">Quality Score</div>
                </div>
              )}
            </div>
            <p className="text-muted" style={{ marginBottom:16, lineHeight:1.7 }}>{ds.description}</p>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12, marginBottom:16 }}>
              {[
                ['Language', ds.language], ['Country', ds.country], ['Dialect', ds.dialect || '—'],
                ['Source', ds.source || '—'], ['Format', ds.file_formats || '—'], ['Size', ds.file_size_mb > 0 ? `${ds.file_size_mb} MB` : '—'],
              ].map(([k, v]) => (
                <div key={k} style={{ background:'var(--bg)', padding:'10px 12px', borderRadius:'var(--radius)' }}>
                  <div className="text-muted text-sm">{k}</div>
                  <div style={{ fontWeight:500, marginTop:2 }}>{v}</div>
                </div>
              ))}
            </div>

            {ds.cultural_context && (
              <div style={{ background:'var(--bg)', padding:12, borderRadius:'var(--radius)', marginBottom:12 }}>
                <div className="text-muted text-sm" style={{ marginBottom:4 }}>Cultural Context</div>
                <div style={{ fontSize:13.5 }}>{ds.cultural_context}</div>
              </div>
            )}
          </div>

          {/* AI Enrichment results */}
          {ds.transcription_text && (
            <div className="card" style={{ marginBottom:20, borderLeft:'3px solid var(--accent)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                <Zap size={16} color="var(--accent)" />
                <span style={{ fontWeight:600 }}>AI Transcription Output</span>
                <span className="badge" style={{ background:'var(--accent-light)', color:'var(--accent)', fontSize:11 }}>Auto-processed</span>
              </div>
              <div style={{ background:'#0f172a', color:'#a5f3fc', padding:16, borderRadius:'var(--radius)', fontFamily:'monospace', fontSize:13, lineHeight:1.8, whiteSpace:'pre-wrap' }}>
                {ds.transcription_text}
              </div>
              {ds.translation_text && (
                <div style={{ marginTop:12, padding:12, background:'var(--success-light)', borderRadius:'var(--radius)' }}>
                  <div className="text-muted text-sm" style={{ marginBottom:4 }}>Translation</div>
                  <div style={{ fontSize:13.5 }}>{ds.translation_text}</div>
                </div>
              )}
              {ds.annotation_details && (
                <div style={{ marginTop:12 }}>
                  <div className="text-muted text-sm" style={{ marginBottom:4 }}>Annotation</div>
                  <div style={{ fontSize:13 }}>{ds.annotation_details}</div>
                </div>
              )}
            </div>
          )}

          {/* Rights */}
          {(ds.rights_info || ds.permitted_uses) && (
            <div className="card">
              <div className="card-title">Rights & Licensing</div>
              {ds.rights_info && <div style={{ fontSize:13, marginBottom:8 }}><strong>Rights:</strong> {ds.rights_info}</div>}
              {ds.permitted_uses && <div style={{ fontSize:13 }}><strong>Permitted Uses:</strong> {ds.permitted_uses}</div>}
            </div>
          )}
        </div>

        {/* Actions sidebar */}
        <div>
          <div className="card" style={{ marginBottom:16 }}>
            <div className="card-title">Workflow Status</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {workflow.map((s, i) => (
                <div key={s} style={{
                  padding:'8px 12px', borderRadius:'var(--radius)', fontSize:13, fontWeight:500,
                  background: i < wfIdx ? 'var(--success-light)' : i === wfIdx ? 'var(--accent-light)' : 'var(--bg)',
                  color: i < wfIdx ? 'var(--success)' : i === wfIdx ? 'var(--accent)' : 'var(--muted)',
                  display:'flex', alignItems:'center', gap:8,
                }}>
                  {i < wfIdx ? <CheckCircle size={14} /> : i === wfIdx ? '●' : '○'}
                  {s.replace('_', ' ')}
                </div>
              ))}
            </div>
          </div>

          {role === 'admin' && (
            <div className="card" style={{ marginBottom:16 }}>
              <div className="card-title">Admin Actions</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {ds.status === 'uploaded' && (
                  <button className="btn btn-outline w-full" onClick={() => setStatus('processing')}>
                    → Start Processing
                  </button>
                )}
                {ds.status === 'processing' && (
                  <button className="btn btn-primary w-full" onClick={runEnrich} disabled={enriching}>
                    <Zap size={14} /> {enriching ? 'Running AI...' : 'Run AI Enrichment'}
                  </button>
                )}
                {ds.status === 'under_review' && (<>
                  <button className="btn btn-success w-full" onClick={() => setStatus('approved')}>
                    <CheckCircle size={14} /> Approve Dataset
                  </button>
                  <button className="btn btn-danger w-full" onClick={() => setShowReject(true)}>
                    <XCircle size={14} /> Reject
                  </button>
                </>)}
                {ds.status === 'approved' && (
                  <button className="btn btn-outline w-full" onClick={() => setStatus('restricted')}>
                    Restrict Access
                  </button>
                )}
              </div>

              {showReject && (
                <div style={{ marginTop:12 }}>
                  <textarea className="form-textarea" placeholder="Rejection reason..." value={reason} onChange={e => setReason(e.target.value)} style={{ marginBottom:8 }} />
                  <div style={{ display:'flex', gap:8 }}>
                    <button className="btn btn-danger btn-sm" onClick={() => { setStatus('rejected', reason); setShowReject(false) }}>Confirm Reject</button>
                    <button className="btn btn-outline btn-sm" onClick={() => setShowReject(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {ds.reject_reason && (
            <div className="alert alert-danger">
              <strong>Rejection reason:</strong><br />{ds.reject_reason}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
