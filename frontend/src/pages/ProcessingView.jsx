import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle, RefreshCw, ArrowLeft, FileAudio } from 'lucide-react'
import api from '../api/client'
import toast from 'react-hot-toast'

const taskIcon = { transcription:'T', diarization:'D', quality_check:'Q', annotation:'A' }
const taskColor = { completed:'var(--success)', processing:'var(--warning)', pending:'var(--muted)', failed:'var(--danger)' }

export default function ProcessingView() {
  const { id } = useParams()
  const nav = useNavigate()
  const [tasks, setTasks] = useState([])
  const [ds, setDs] = useState(null)
  const [enriching, setEnriching] = useState(false)

  useEffect(() => { load() }, [id])

  async function load() {
    const [d, t] = await Promise.all([api.get(`/datasets/${id}`), api.get(`/datasets/${id}/processing`)])
    setDs(d.data); setTasks(t.data)
  }

  async function runEnrich() {
    setEnriching(true)
    try {
      await api.patch(`/datasets/${id}/enrich`)
      toast.success('AI processing complete!')
      load()
    } finally { setEnriching(false) }
  }

  const byFile = tasks.reduce((acc, t) => {
    if (!acc[t.file_name]) acc[t.file_name] = []
    acc[t.file_name].push(t)
    return acc
  }, {})

  const allDone = tasks.length > 0 && tasks.every(t => t.status === 'completed')

  return (
    <div>
      <button className="btn btn-ghost" style={{ marginBottom:16 }} onClick={() => nav(`/datasets/${id}`)}>
        <ArrowLeft size={14}/> Back to Dataset
      </button>

      <div className="page-header">
        <div>
          <h2>Processing Tasks</h2>
          {ds && <p className="text-muted text-sm mt-2">{ds.name} — {tasks.length} tasks</p>}
        </div>
        {ds?.status === 'processing' && (
          <button className="btn btn-primary" onClick={runEnrich} disabled={enriching}>
            {enriching ? <><span className="spinner"/> Processing...</> : 'Run AI Enrichment'}
          </button>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:40 }}>
          <p className="text-muted">No processing tasks yet.</p>
          {ds?.status === 'uploaded' && <p className="text-muted text-sm mt-2">Start processing from the Dataset Detail page.</p>}
        </div>
      ) : (
        <>
          {/* Summary row */}
          <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
            {['transcription','diarization','quality_check'].map(type => {
              const t = tasks.find(t => t.task_type === type)
              return (
                <div key={type} className="card" style={{ flex:1, minWidth:180, borderTop:`3px solid ${taskColor[t?.status||'pending']}` }}>
                  <div style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', color:'var(--muted)', marginBottom:6 }}>{type.replace('_',' ')}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    {t?.status === 'completed' ? <CheckCircle size={18} color="var(--success)"/> : <RefreshCw size={18} color="var(--muted)"/>}
                    <span style={{ fontWeight:600, color:taskColor[t?.status||'pending'], textTransform:'capitalize' }}>{t?.status || 'pending'}</span>
                    {t?.confidence && <span className="text-muted text-sm">{(t.confidence*100).toFixed(0)}% conf.</span>}
                  </div>
                </div>
              )
            })}
          </div>

          {/* File-by-file breakdown */}
          {Object.entries(byFile).map(([fname, ftasks]) => (
            <div key={fname} className="card" style={{ marginBottom:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                <FileAudio size={16} color="var(--accent)"/>
                <span style={{ fontWeight:600 }}>{fname}</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {ftasks.map(t => (
                  <div key={t.id} style={{ display:'grid', gridTemplateColumns:'140px 100px 1fr', gap:12, alignItems:'start', padding:'8px 12px', background:'var(--bg)', borderRadius:'var(--radius)' }}>
                    <div style={{ fontWeight:500, fontSize:13, textTransform:'capitalize' }}>{t.task_type.replace('_',' ')}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      {t.status === 'completed' ? <CheckCircle size={14} color="var(--success)"/> : t.status === 'failed' ? <XCircle size={14} color="var(--danger)"/> : <RefreshCw size={14} color="var(--muted)"/>}
                      <span style={{ fontSize:12, color:taskColor[t.status], fontWeight:600, textTransform:'capitalize' }}>{t.status}</span>
                    </div>
                    <div style={{ fontSize:12, color:'#374151', fontFamily: t.task_type==='transcription' ? 'monospace' : 'inherit' }}>
                      {t.result_text || '—'}
                      {t.confidence && <span className="text-muted" style={{ marginLeft:8 }}>({(t.confidence*100).toFixed(0)}%)</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {allDone && (
            <div className="alert alert-success">
              All processing tasks complete. Ready for human review.
              <button className="btn btn-primary btn-sm" style={{ marginLeft:12 }} onClick={() => nav(`/datasets/${id}/review`)}>
                Go to Review
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
