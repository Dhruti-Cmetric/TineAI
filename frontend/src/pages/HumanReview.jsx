import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import api from '../api/client'
import toast from 'react-hot-toast'

export default function HumanReview() {
  const { id } = useParams()
  const nav = useNavigate()
  const [ds, setDs] = useState(null)
  const [tasks, setTasks] = useState([])
  const [reviews, setReviews] = useState([])
  const [form, setForm] = useState({
    decision: 'pass',
    transcription_quality: 'correct',
    annotation_quality: 'correct',
    dialect_accuracy: 'correct',
    comments: '',
    corrections: '',
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { load() }, [id])

  async function load() {
    const [d, t, r] = await Promise.all([
      api.get(`/datasets/${id}`),
      api.get(`/datasets/${id}/processing`),
      api.get(`/datasets/${id}/reviews`),
    ])
    setDs(d.data); setTasks(t.data); setReviews(r.data)
  }

  async function submitReview(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      await api.post(`/datasets/${id}/review`, fd)
      toast.success(`Review submitted: ${form.decision}`)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Submission failed')
    } finally { setSubmitting(false) }
  }

  const qualityOptions = ['correct', 'incorrect', 'partial']
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const decisionColors = { pass:'var(--success)', fail:'var(--danger)', changes_requested:'var(--warning)' }

  return (
    <div>
      <button className="btn btn-ghost" style={{ marginBottom:16 }} onClick={() => nav(`/datasets/${id}`)}>
        <ArrowLeft size={14}/> Back to Dataset
      </button>

      <div className="page-header">
        <div>
          <h2>Human Review</h2>
          {ds && <p className="text-muted text-sm mt-2">{ds.name} — Quality verification before TINE AI approval</p>}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:20 }}>
        <div>
          {/* Processing results to review */}
          {tasks.length > 0 && (
            <div className="card" style={{ marginBottom:20 }}>
              <div className="card-title">Processing Results to Review</div>
              {tasks.map(t => (
                <div key={t.id} style={{ marginBottom:12, padding:'10px 12px', background:'var(--bg)', borderRadius:'var(--radius)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontWeight:600, fontSize:13, textTransform:'capitalize' }}>{t.task_type.replace('_',' ')} — {t.file_name}</span>
                    {t.confidence && <span className="text-muted text-sm">{(t.confidence*100).toFixed(0)}% confidence</span>}
                  </div>
                  {t.result_text && (
                    <div style={{ fontFamily:'monospace', fontSize:12, color:'#374151', lineHeight:1.7 }}>{t.result_text}</div>
                  )}
                </div>
              ))}
              {ds?.transcription_text && (
                <div style={{ marginTop:8, padding:12, background:'#0f172a', color:'#a5f3fc', borderRadius:'var(--radius)', fontFamily:'monospace', fontSize:12, lineHeight:1.7 }}>
                  {ds.transcription_text}
                </div>
              )}
            </div>
          )}

          {/* Review form */}
          <div className="card">
            <div className="card-title">Submit Quality Review (§9.8)</div>
            <form onSubmit={submitReview}>
              {/* Decision */}
              <div className="form-group">
                <label className="form-label">Review Decision *</label>
                <div style={{ display:'flex', gap:10 }}>
                  {['pass','fail','changes_requested'].map(d => (
                    <button key={d} type="button"
                      style={{ padding:'8px 18px', borderRadius:'var(--radius)', border:`2px solid ${form.decision===d ? decisionColors[d] : 'var(--border)'}`,
                        background: form.decision===d ? decisionColors[d]+'15' : 'var(--bg)',
                        color: form.decision===d ? decisionColors[d] : 'var(--muted)',
                        fontWeight:600, fontSize:13, cursor:'pointer', textTransform:'capitalize' }}
                      onClick={() => set('decision', d)}>
                      {d === 'pass' ? <CheckCircle size={14} style={{ verticalAlign:'middle', marginRight:4 }}/> :
                       d === 'fail' ? <XCircle size={14} style={{ verticalAlign:'middle', marginRight:4 }}/> :
                       <AlertTriangle size={14} style={{ verticalAlign:'middle', marginRight:4 }}/>}
                      {d.replace('_',' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality fields */}
              <div className="form-grid">
                {[
                  ['Transcription Quality', 'transcription_quality'],
                  ['Annotation Quality', 'annotation_quality'],
                  ['Dialect/Regional Accuracy', 'dialect_accuracy'],
                ].map(([label, key]) => (
                  <div className="form-group" key={key}>
                    <label className="form-label">{label}</label>
                    <select className="form-select" value={form[key]} onChange={e => set(key, e.target.value)}>
                      {qualityOptions.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <div className="form-group">
                <label className="form-label">Review Comments</label>
                <textarea className="form-textarea" value={form.comments} onChange={e => set('comments', e.target.value)}
                  placeholder="Describe quality findings, issues observed, regional accuracy assessment..." />
              </div>
              <div className="form-group">
                <label className="form-label">Corrections / Notes for Supplier</label>
                <textarea className="form-textarea" value={form.corrections} onChange={e => set('corrections', e.target.value)}
                  placeholder="List specific corrections needed if any..." style={{ minHeight:60 }} />
              </div>

              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? <span className="spinner"/> : 'Submit Review'}
              </button>
            </form>
          </div>
        </div>

        {/* Past reviews + Data Card info */}
        <div>
          {ds && (
            <div className="card" style={{ marginBottom:16 }}>
              <div className="card-title">Data Card Summary</div>
              {[['Language', ds.language], ['Country', ds.country], ['Dialect', ds.dialect||'—'],
                ['Quality Score', ds.quality_score ? `${(ds.quality_score*100).toFixed(0)}%` : '—'],
                ['Status', ds.status]].map(([k,v]) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
                  <span className="text-muted">{k}</span><span style={{ fontWeight:500 }}>{v}</span>
                </div>
              ))}
            </div>
          )}

          {reviews.length > 0 && (
            <div className="card">
              <div className="card-title">Review History</div>
              {reviews.map(r => (
                <div key={r.id} style={{ marginBottom:12, padding:'10px 12px', background:'var(--bg)', borderRadius:'var(--radius)', borderLeft:`3px solid ${decisionColors[r.decision]||'#e2e8f0'}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontWeight:600, fontSize:13, color:decisionColors[r.decision], textTransform:'capitalize' }}>{r.decision.replace('_',' ')}</span>
                    <span className="text-muted text-sm">{new Date(r.submitted_at).toLocaleDateString()}</span>
                  </div>
                  <div className="text-muted text-sm" style={{ marginBottom:2 }}>by {r.reviewer_name}</div>
                  {r.comments && <div style={{ fontSize:12 }}>{r.comments}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
