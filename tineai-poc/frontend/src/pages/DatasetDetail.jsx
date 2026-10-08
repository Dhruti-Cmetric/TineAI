import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  CheckCircle, XCircle, Zap, ArrowLeft, FileAudio, FileVideo, Image,
  Cpu, Star, GitBranch, RefreshCw, Play, Clock, AlertTriangle, Edit2, Save, X
} from 'lucide-react'
import api from '../api/client'
import toast from 'react-hot-toast'

const statusBadge = s => <span className={`badge badge-${s}`}>{s?.replace(/_/g, ' ')}</span>
const workflow = ['uploaded', 'processing', 'under_review', 'approved', 'available']

const STEP_COLORS = {
  completed: 'var(--success)', running: 'var(--warning)',
  failed: 'var(--danger)', pending: 'var(--muted)', skipped: '#94a3b8'
}
const STEP_ICONS = {
  completed: <CheckCircle size={13} />, running: <RefreshCw size={13} />,
  failed: <XCircle size={13} />, pending: <Clock size={13} />, skipped: <AlertTriangle size={13} />
}

export default function DatasetDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [ds, setDs] = useState(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState([])
  const [running, setRunning] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState('')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const role = localStorage.getItem('role')

  const LANGS = ['Yoruba','Swahili','Amharic','Hausa','Zulu','Igbo','Cameroonian French',
    'Nigerian English','Twi','Somali','Wolof','Tigrinya','Shona','Xhosa','Other']
  const COUNTRIES = ['Nigeria','Kenya','Ethiopia','Ghana','South Africa','Cameroon',
    'Tanzania','Uganda','Senegal','Egypt','Morocco','Zimbabwe','Other']
  const USES = ['AI model training','Speech recognition','Dialect research',
    'Translation model training','Cultural alignment','Academic research']

  function openEdit() {
    setEditForm({
      name: ds.name || '',
      description: ds.description || '',
      data_type: ds.data_type || 'audio',
      language: ds.language || '',
      country: ds.country || '',
      dialect: ds.dialect || '',
      cultural_context: ds.cultural_context || '',
      source: ds.source || '',
      rights_info: ds.rights_info || '',
      permitted_uses: ds.permitted_uses || '',
      annotation_details: ds.annotation_details || '',
      version: ds.version || '1.0',
      file_formats: ds.file_formats || '',
    })
    setEditing(true)
  }

  async function saveDataCard() {
    setSaving(true)
    try {
      await api.patch(`/datasets/${id}`, editForm)
      toast.success('Data Card saved!')
      setEditing(false)
      loadDs()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Save failed')
    } finally { setSaving(false) }
  }

  function toggleUse(u) {
    const cur = editForm.permitted_uses ? editForm.permitted_uses.split(', ').filter(Boolean) : []
    const next = cur.includes(u) ? cur.filter(x => x !== u) : [...cur, u]
    setEditForm(f => ({ ...f, permitted_uses: next.join(', ') }))
  }

  const loadDs = useCallback(async () => {
    const [{ data: d }, { data: j }] = await Promise.all([
      api.get(`/datasets/${id}`),
      api.get(`/pipeline/jobs?dataset_id=${id}`).catch(() => ({ data: [] })),
    ])
    setDs(d)
    setJobs(j || [])
    setLoading(false)
  }, [id])

  useEffect(() => {
    loadDs()
    // auto-refresh while a job is running
    const iv = setInterval(() => {
      if (jobs.some(j => j.status === 'running' || j.status === 'pending')) loadDs()
    }, 4000)
    return () => clearInterval(iv)
  }, [loadDs, jobs.length])

  async function setStatus(newStatus, rejectReason = '') {
    await api.patch(`/datasets/${id}/status?new_status=${newStatus}${rejectReason ? `&reason=${encodeURIComponent(rejectReason)}` : ''}`)
    toast.success(`Status → ${newStatus}`)
    loadDs()
  }

  async function runPipeline() {
    setRunning(true)
    try {
      const { data } = await api.post(`/pipeline/run/${id}`, { tgt_lang: 'eng_Latn' })
      toast.success(`Pipeline started — job #${data.job_id}`)
      loadDs()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Pipeline failed to start')
    } finally { setRunning(false) }
  }

  async function retryJob(jobId) {
    await api.post(`/pipeline/jobs/${jobId}/retry`)
    toast.success('Job queued for retry')
    loadDs()
  }

  if (loading) return <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>
  if (!ds) return <div className="empty-state">Dataset not found.</div>

  const wfIdx = workflow.indexOf(ds.status)
  const TypeIcon = ds.data_type === 'audio' ? FileAudio : ds.data_type === 'video' ? FileVideo : Image
  const latestJob = jobs[0] || null

  return (
    <div>
      {/* Top nav */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost" onClick={() => nav('/datasets')}><ArrowLeft size={14} /> Back</button>
        <button className="btn btn-outline btn-sm" onClick={openEdit}><Edit2 size={13} /> Edit Data Card</button>
        <button className="btn btn-outline btn-sm" onClick={() => nav(`/datasets/${id}/processing`)}><Cpu size={13} /> Processing</button>
        <button className="btn btn-outline btn-sm" onClick={() => nav(`/datasets/${id}/review`)}><Star size={13} /> Review</button>
        <button className="btn btn-outline btn-sm" onClick={() => nav(`/datasets/${id}/versions`)}><GitBranch size={13} /> Versions</button>
      </div>

      {/* ── INLINE EDIT DATA CARD PANEL ───────────────────────────── */}
      {editing && (
        <div className="card" style={{ marginBottom: 20, border: '2px solid var(--accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Edit2 size={16} color="var(--accent)" />
              <span style={{ fontWeight: 700, fontSize: 16 }}>Edit Data Card</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}><X size={14} /></button>
          </div>

          {/* Row 1: Name + Type + Version */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Dataset Name *</label>
              <input className="form-input" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Type</label>
              <select className="form-select" value={editForm.data_type} onChange={e => setEditForm(f => ({ ...f, data_type: e.target.value }))}>
                <option value="audio">Audio</option>
                <option value="video">Video</option>
                <option value="image">Image</option>
                <option value="text">Text</option>
                <option value="document">Document</option>
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Version</label>
              <input className="form-input" value={editForm.version} onChange={e => setEditForm(f => ({ ...f, version: e.target.value }))} />
            </div>
          </div>

          {/* Row 2: Language + Country + Dialect */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Language *</label>
              <select className="form-select" value={editForm.language} onChange={e => setEditForm(f => ({ ...f, language: e.target.value }))}>
                <option value="">Select...</option>
                {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Country *</label>
              <select className="form-select" value={editForm.country} onChange={e => setEditForm(f => ({ ...f, country: e.target.value }))}>
                <option value="">Select...</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Dialect / Accent</label>
              <input className="form-input" value={editForm.dialect} placeholder="e.g. Lagos Yoruba" onChange={e => setEditForm(f => ({ ...f, dialect: e.target.value }))} />
            </div>
          </div>

          {/* Description */}
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={editForm.description} rows={3}
              onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Dataset content, collection method, speaker demographics..." />
          </div>

          {/* Row 3: Source + Formats + Cultural Context */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Data Source</label>
              <input className="form-input" value={editForm.source} onChange={e => setEditForm(f => ({ ...f, source: e.target.value }))} placeholder="e.g. Community recordings — Lagos, 2025" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">File Formats</label>
              <input className="form-input" value={editForm.file_formats} onChange={e => setEditForm(f => ({ ...f, file_formats: e.target.value }))} placeholder="wav, mp4, jpg..." />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Cultural Context</label>
            <input className="form-input" value={editForm.cultural_context} onChange={e => setEditForm(f => ({ ...f, cultural_context: e.target.value }))} placeholder="e.g. Urban market, rural agricultural, broadcast media..." />
          </div>

          {/* Annotation details */}
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Annotation Details</label>
            <textarea className="form-textarea" value={editForm.annotation_details} rows={2}
              onChange={e => setEditForm(f => ({ ...f, annotation_details: e.target.value }))}
              placeholder="e.g. Speaker diarization complete. 3 speakers per clip. Sentence-level transcription." />
          </div>

          {/* Rights */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Rights & Ownership</label>
              <textarea className="form-textarea" value={editForm.rights_info} rows={2}
                onChange={e => setEditForm(f => ({ ...f, rights_info: e.target.value }))}
                placeholder="e.g. TINE AI owns all rights..." />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Permitted Uses</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                {USES.map(u => (
                  <button key={u} type="button"
                    style={{ padding: '3px 9px', borderRadius: 12, fontSize: 11, border: '1px solid var(--border)', cursor: 'pointer',
                      background: (editForm.permitted_uses || '').includes(u) ? 'var(--accent)' : 'var(--bg)',
                      color: (editForm.permitted_uses || '').includes(u) ? '#fff' : 'var(--muted)' }}
                    onClick={() => toggleUse(u)}>{u}
                  </button>
                ))}
              </div>
              <input className="form-input" value={editForm.permitted_uses}
                onChange={e => setEditForm(f => ({ ...f, permitted_uses: e.target.value }))}
                placeholder="or type custom uses..." />
            </div>
          </div>

          {/* Save / Cancel */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" onClick={() => setEditing(false)}><X size={14} /> Cancel</button>
            <button className="btn btn-primary" onClick={saveDataCard} disabled={saving}>
              <Save size={14} /> {saving ? 'Saving...' : 'Save Data Card'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        {/* LEFT: main content */}
        <div>
          {/* Data Card header */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <TypeIcon size={20} color="var(--accent)" />
                  <h2 style={{ fontSize: 20, fontWeight: 700 }}>{ds.name}</h2>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {statusBadge(ds.status)}
                  <span className={`badge badge-${ds.data_type}`}>{ds.data_type}</span>
                  <span className="badge" style={{ background: '#f1f5f9', color: 'var(--muted)' }}>v{ds.version}</span>
                </div>
              </div>
              {ds.quality_score != null && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: ds.quality_score >= 0.7 ? 'var(--success)' : 'var(--warning)' }}>
                    {(ds.quality_score * 100).toFixed(0)}%
                  </div>
                  <div className="text-muted text-sm">Quality Score</div>
                </div>
              )}
            </div>
            <p className="text-muted" style={{ marginBottom: 16, lineHeight: 1.7 }}>{ds.description}</p>

            {/* auto-detected badge */}
            {(() => {
              try {
                const cd = ds.collection_details ? JSON.parse(ds.collection_details) : null
                const ad = cd?.auto_lang_detect
                if (!ad) return null
                return (
                  <div style={{ display:'flex', alignItems:'center', gap:8, background:'#eff6ff', border:'1px solid #bfdbfe',
                    borderRadius:6, padding:'7px 12px', marginBottom:12, fontSize:12 }}>
                    <span style={{ fontSize:15 }}>🪄</span>
                    <span>
                      <strong style={{ color:'#1d4ed8' }}>Auto-detected:</strong>{' '}
                      {ad.language_name} ({ad.language_code}) · {ad.country}
                      {ad.dialect ? ` · ${ad.dialect}` : ''}
                      {ad.confidence ? ` · ${(ad.confidence * 100).toFixed(0)}% confidence` : ''}
                    </span>
                  </div>
                )
              } catch { return null }
            })()}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
              {[
                ['Language', ds.language], ['Country', ds.country], ['Dialect', ds.dialect || '—'],
                ['Source', ds.source || '—'], ['Format', ds.file_formats || '—'],
                ['Size', ds.file_size_mb > 0 ? `${ds.file_size_mb} MB` : '—'],
              ].map(([k, v]) => (
                <div key={k} style={{ background: 'var(--bg)', padding: '10px 12px', borderRadius: 'var(--radius)' }}>
                  <div className="text-muted text-sm">{k}</div>
                  <div style={{ fontWeight: 500, marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>
            {ds.cultural_context && (
              <div style={{ background: 'var(--bg)', padding: 12, borderRadius: 'var(--radius)', marginBottom: 0 }}>
                <div className="text-muted text-sm" style={{ marginBottom: 4 }}>Cultural Context</div>
                <div style={{ fontSize: 13.5 }}>{ds.cultural_context}</div>
              </div>
            )}
          </div>

          {/* ── PIPELINE JOB STATUS ─────────────────────────────────── */}
          {latestJob && (
            <div className="card" style={{ marginBottom: 20, borderLeft: `3px solid ${latestJob.status === 'completed' ? 'var(--success)' : latestJob.status === 'failed' ? 'var(--danger)' : 'var(--warning)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Zap size={15} color="var(--accent)" />
                  <span style={{ fontWeight: 600 }}>Pipeline Job #{latestJob.id}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: STEP_COLORS[latestJob.status], textTransform: 'capitalize' }}>
                    {latestJob.status}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={loadDs}><RefreshCw size={12} /></button>
                  {latestJob.status === 'failed' && (
                    <button className="btn btn-outline btn-sm" onClick={() => retryJob(latestJob.id)}>Retry</button>
                  )}
                </div>
              </div>

              {/* Step grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                {(latestJob.steps || []).map(step => (
                  <div key={step.id} style={{
                    padding: '8px 10px', borderRadius: 6,
                    background: 'var(--bg)',
                    borderLeft: `3px solid ${STEP_COLORS[step.status] || 'var(--muted)'}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                      <span style={{ color: STEP_COLORS[step.status] }}>{STEP_ICONS[step.status]}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: STEP_COLORS[step.status] }}>
                        {step.task_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {step.confidence != null && (
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{(step.confidence * 100).toFixed(0)}% conf</div>
                    )}
                    {step.duration_seconds != null && (
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{step.duration_seconds.toFixed(1)}s</div>
                    )}
                    {step.status === 'failed' && step.error_message && (
                      <div style={{ fontSize: 10, color: 'var(--danger)', marginTop: 2 }}>{step.error_message.slice(0, 60)}</div>
                    )}
                  </div>
                ))}
              </div>

              {(latestJob.status === 'running' || latestJob.status === 'pending') && (
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
                  Auto-refreshing every 4 seconds...
                </div>
              )}
            </div>
          )}

          {/* ── AI RESULTS ──────────────────────────────────────────── */}
          {(ds.diarization_info || ds.transcription_text || ds.translation_text) && (() => {
            // helpers
            const PALETTE = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16']
            const toHMS = secs => {
              const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = Math.floor(secs % 60)
              return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
            }

            // parse diarization
            let segs = [], speakers = [], colorOf = () => '#94a3b8', maxEnd = 0, dModel = 'auto', speakerCount = 0
            if (ds.diarization_info) {
              try {
                const d = JSON.parse(ds.diarization_info)
                segs = d.segments || []
                speakers = [...new Set(segs.map(s => s.speaker))]
                colorOf = sp => PALETTE[speakers.indexOf(sp) % PALETTE.length]
                maxEnd = segs.reduce((m, s) => Math.max(m, s.end), 0) || 1
                dModel = d.model || 'auto'
                speakerCount = d.speaker_count ?? speakers.length
              } catch {}
            }

            // split transcription into words with rough per-word timestamps
            // map each segment → slice of transcription text proportional to segment duration
            const transcription = ds.transcription_text || ''
            const words = transcription.trim().split(/\s+/).filter(Boolean)
            const totalDur = maxEnd || 1
            // assign words to segments proportionally by duration
            const segWords = segs.map((s, si) => {
              const frac = (s.end - s.start) / totalDur
              const count = Math.max(1, Math.round(words.length * frac))
              return count
            })
            // build per-segment text slices
            let wi = 0
            const segText = segs.map((s, si) => {
              const slice = words.slice(wi, wi + segWords[si]).join(' ')
              wi += segWords[si]
              return slice
            })
            // remaining words go to last segment
            if (wi < words.length && segText.length > 0) {
              segText[segText.length - 1] += ' ' + words.slice(wi).join(' ')
            }

            return (
              <div className="card" style={{ marginBottom: 20 }}>
                {/* ── header ── */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 14 }}>
                  <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
                    <Zap size={15} color="var(--accent)" />
                    <span style={{ fontWeight: 700, fontSize: 14 }}>Diarization Transcript</span>
                    {speakerCount > 0 && (
                      <span style={{ fontSize: 11, padding:'2px 8px', borderRadius: 8,
                        background:'var(--accent-light)', color:'var(--accent)', fontWeight: 600 }}>
                        {speakerCount} speaker{speakerCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {segs.length > 0 && (
                      <span className="text-muted" style={{ fontSize: 11 }}>
                        {segs.length} segments · {toHMS(maxEnd)} · {dModel}
                      </span>
                    )}
                  </div>
                </div>

                {/* ── speaker legend ── */}
                {speakers.length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap: 10, marginBottom: 12,
                    padding:'8px 12px', background:'var(--bg)', borderRadius: 6 }}>
                    {speakers.map(sp => (
                      <div key={sp} style={{ display:'flex', alignItems:'center', gap: 5 }}>
                        <div style={{ width: 10, height: 10, borderRadius:'50%', background: colorOf(sp) }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: colorOf(sp) }}>{sp}</span>
                        <span className="text-muted" style={{ fontSize: 11 }}>
                          {segs.filter(s => s.speaker === sp).reduce((t, s) => t + (s.end - s.start), 0).toFixed(1)}s
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── visual timeline bar ── */}
                {segs.length > 0 && (
                  <div style={{ position:'relative', height: 20, background:'#f1f5f9',
                    borderRadius: 4, overflow:'hidden', marginBottom: 16 }}>
                    {segs.map((s, i) => (
                      <div key={i} title={`${s.speaker}: ${toHMS(s.start)} – ${toHMS(s.end)}`}
                        style={{
                          position:'absolute',
                          left:`${(s.start / maxEnd) * 100}%`,
                          width:`${Math.max(0.3, ((s.end - s.start) / maxEnd) * 100)}%`,
                          height:'100%', background: colorOf(s.speaker), opacity: 0.8,
                        }} />
                    ))}
                  </div>
                )}

                {/* ── transcript body — HH:MM:SS [Speaker N] + text ── */}
                {segs.length > 0 ? (
                  <div style={{ maxHeight: 480, overflowY:'auto', fontFamily:'monospace',
                    fontSize: 13, lineHeight: 1.9, background:'#fdfdfd',
                    border:'1px solid var(--border)', borderRadius: 6, padding:'2px 0' }}>
                    {segs.map((s, i) => (
                      <div key={i} style={{
                        padding:'10px 14px',
                        borderBottom: i < segs.length - 1 ? '1px solid #f1f5f9' : 'none',
                        background: i % 2 === 0 ? 'transparent' : '#fafafa',
                      }}>
                        {/* timestamp + speaker line */}
                        <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 3 }}>
                          <span style={{ color:'#64748b', fontSize: 11, fontFamily:'monospace', letterSpacing:'0.02em' }}>
                            {toHMS(s.start)}
                          </span>
                          <span style={{
                            fontSize: 11, fontWeight: 700, fontFamily:'sans-serif',
                            color: colorOf(s.speaker),
                            padding:'1px 8px', borderRadius: 10,
                            background: colorOf(s.speaker) + '18',
                            border: `1px solid ${colorOf(s.speaker)}44`,
                          }}>
                            [{s.speaker}]
                          </span>
                          <span style={{ fontSize: 11, color:'#94a3b8', fontFamily:'monospace' }}>
                            →{toHMS(s.end)} ({(s.end - s.start).toFixed(1)}s)
                          </span>
                        </div>
                        {/* transcript text for this segment */}
                        <div style={{ paddingLeft: 4, color:'#1e293b', fontSize: 13.5,
                          fontFamily:'system-ui, sans-serif', lineHeight: 1.7 }}>
                          {segText[i] || <span style={{ color:'#94a3b8', fontStyle:'italic' }}>[no transcript for this segment]</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : transcription ? (
                  /* no diarization — plain transcript */
                  <div style={{ background:'#0f172a', color:'#a5f3fc', padding: 14, borderRadius: 6,
                    fontFamily:'monospace', fontSize: 12.5, lineHeight: 1.8, whiteSpace:'pre-wrap' }}>
                    {transcription}
                  </div>
                ) : null}

                {/* ── translation ── */}
                {ds.translation_text && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color:'var(--muted)', marginBottom: 6 }}>
                      🌐 Translation → English
                    </div>
                    <div style={{ padding:'10px 14px', background:'var(--success-light)',
                      borderRadius: 6, fontSize: 13.5, lineHeight: 1.7 }}>
                      {ds.translation_text}
                    </div>
                  </div>
                )}

                {/* ── annotation details ── */}
                {ds.annotation_details && (
                  <div style={{ marginTop: 14 }}>
                    <div className="text-muted text-sm" style={{ marginBottom: 4 }}>Annotation Details</div>
                    <div style={{ fontSize: 13 }}>{ds.annotation_details}</div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Rights */}
          {(ds.rights_info || ds.permitted_uses) && (
            <div className="card">
              <div className="card-title">Rights & Licensing</div>
              {ds.rights_info && <div style={{ fontSize: 13, marginBottom: 8 }}><strong>Rights:</strong> {ds.rights_info}</div>}
              {ds.permitted_uses && <div style={{ fontSize: 13 }}><strong>Permitted Uses:</strong> {ds.permitted_uses}</div>}
            </div>
          )}
        </div>

        {/* RIGHT: actions sidebar */}
        <div>
          {/* Workflow progress */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">Workflow Status</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {workflow.map((s, i) => (
                <div key={s} style={{
                  padding: '8px 12px', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500,
                  background: i < wfIdx ? 'var(--success-light)' : i === wfIdx ? 'var(--accent-light)' : 'var(--bg)',
                  color: i < wfIdx ? 'var(--success)' : i === wfIdx ? 'var(--accent)' : 'var(--muted)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  {i < wfIdx ? <CheckCircle size={14} /> : i === wfIdx ? '●' : '○'}
                  {s.replace(/_/g, ' ')}
                </div>
              ))}
            </div>
          </div>

          {/* Pipeline actions */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">AI Pipeline</div>
            <button
              className="btn btn-primary w-full"
              style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }}
              onClick={runPipeline}
              disabled={running || latestJob?.status === 'running'}
            >
              <Play size={14} />
              {running ? 'Starting...' : latestJob ? 'Re-run Pipeline' : 'Run Full Pipeline'}
            </button>
            <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
              Runs: Quality Check → Lang ID → STT → Diarization → Translation → Text Understanding → TTS
            </div>
            {jobs.length > 1 && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
                {jobs.length} total jobs — <button className="btn btn-ghost btn-sm" style={{ padding: '0 4px', fontSize: 12 }} onClick={() => nav(`/datasets/${id}/processing`)}>view all</button>
              </div>
            )}
          </div>

          {/* Admin actions */}
          {role === 'admin' && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-title">Admin Actions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ds.status === 'uploaded' && (
                  <button className="btn btn-outline w-full" onClick={() => setStatus('processing')}>
                    → Start Processing
                  </button>
                )}
                {ds.status === 'processing' && (
                  <button className="btn btn-outline w-full" onClick={() => setStatus('under_review')}>
                    → Send to Review
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
                  <button className="btn btn-outline w-full" onClick={() => setStatus('available')}>
                    → Make Available
                  </button>
                )}
              </div>

              {showReject && (
                <div style={{ marginTop: 12 }}>
                  <textarea className="form-textarea" placeholder="Rejection reason..." value={reason} onChange={e => setReason(e.target.value)} style={{ marginBottom: 8 }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-danger btn-sm" onClick={() => { setStatus('processing', reason); setShowReject(false) }}>Confirm</button>
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
