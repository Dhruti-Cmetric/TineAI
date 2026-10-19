import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, Zap, CheckCircle, XCircle, Clock, AlertTriangle, Activity, BarChart2 } from 'lucide-react'
import api from '../api/client'
import toast from 'react-hot-toast'

const STEP_COLORS = {
  completed: '#10b981', running: '#f59e0b', failed: '#ef4444', pending: '#94a3b8', skipped: '#cbd5e1'
}

const TASK_SHORT = {
  speech_to_text: 'STT', diarization: 'DIAR', translation: 'TRANS',
  speech_translation: 'S-TRANS', text_understanding: 'NLU', text_to_speech: 'TTS',
  language_identification: 'LANG-ID', ocr: 'OCR', image_annotation: 'IMG-ANN',
  video_processing: 'VIDEO', quality_check: 'QC', custom_training: 'TRAIN',
}

function StepPill({ step }) {
  const c = STEP_COLORS[step.status] || '#94a3b8'
  return (
    <span title={`${step.task_type}: ${step.status}${step.error_message ? ' — ' + step.error_message : ''}`}
      style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8, background: c + '22', color: c, fontWeight: 700, border: `1px solid ${c}44` }}>
      {TASK_SHORT[step.task_type] || step.task_type}
    </span>
  )
}

export default function PipelineMonitor() {
  const [jobs, setJobs] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const nav = useNavigate()

  const load = useCallback(async () => {
    try {
      const [{ data: j }, { data: s }] = await Promise.all([
        api.get('/pipeline/jobs?limit=100'),
        api.get('/pipeline/stats').catch(() => ({ data: null })),
      ])
      setJobs(j)
      setStats(s)
    } catch { toast.error('Failed to load pipeline data') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!autoRefresh) return
    const iv = setInterval(() => {
      if (jobs.some(j => j.status === 'running' || j.status === 'pending')) load()
    }, 4000)
    return () => clearInterval(iv)
  }, [autoRefresh, jobs, load])

  async function retryJob(id) {
    try {
      await api.post(`/pipeline/jobs/${id}/retry`)
      toast.success('Job requeued')
      load()
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed') }
  }

  async function deleteJob(id) {
    try {
      await api.delete(`/pipeline/jobs/${id}`)
      toast.success('Job deleted')
      load()
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed') }
  }

  const filtered = filterStatus ? jobs.filter(j => j.status === filterStatus) : jobs

  const statusIcon = s => ({
    completed: <CheckCircle size={13} color="#10b981" />,
    failed: <XCircle size={13} color="#ef4444" />,
    running: <RefreshCw size={13} color="#f59e0b" className="spin" />,
    pending: <Clock size={13} color="#94a3b8" />,
  }[s] || <AlertTriangle size={13} />)

  if (loading) return <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Pipeline Monitor</h2>
          <p className="text-muted text-sm mt-2">Live view of all AI processing jobs across datasets</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
            Auto-refresh
          </label>
          <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={13} /> Refresh</button>
        </div>
      </div>

      {/* stats bar */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Total Jobs', value: stats.jobs.total, color: '#3b82f6', bg: '#eff6ff' },
            { label: 'Running', value: stats.jobs.running, color: '#f59e0b', bg: '#fffbeb' },
            { label: 'Completed', value: stats.jobs.completed, color: '#10b981', bg: '#ecfdf5' },
            { label: 'Failed', value: stats.jobs.failed, color: '#ef4444', bg: '#fef2f2' },
            { label: 'Steps Done', value: stats.steps.completed, color: '#8b5cf6', bg: '#f5f3ff' },
          ].map(c => (
            <div key={c.label} style={{ background: c.bg, border: `1px solid ${c.color}22`, borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* task type step counts */}
      {stats?.by_task_type && Object.keys(stats.by_task_type).length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <BarChart2 size={15} color="var(--accent)" />
            <span style={{ fontWeight: 600 }}>Completed Steps by Task Type</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(stats.by_task_type).map(([tt, cnt]) => (
              <div key={tt} style={{ background: 'var(--bg)', padding: '6px 12px', borderRadius: 8, fontSize: 12 }}>
                <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{cnt}</span>
                <span className="text-muted" style={{ marginLeft: 6 }}>{TASK_SHORT[tt] || tt}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['', 'running', 'pending', 'completed', 'failed'].map(s => (
          <button key={s} className={`btn btn-sm ${filterStatus === s ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilterStatus(s)}>
            {s || 'All'} {s && stats?.jobs[s] != null ? `(${stats.jobs[s]})` : ''}
          </button>
        ))}
      </div>

      {/* job table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
              {['Job #', 'Dataset', 'Status', 'Steps', 'Started', 'Duration', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>No jobs found</td></tr>
            )}
            {filtered.map(job => {
              const dur = job.started_at && job.completed_at
                ? ((new Date(job.completed_at) - new Date(job.started_at)) / 1000).toFixed(0) + 's'
                : job.started_at && job.status === 'running'
                  ? ((Date.now() - new Date(job.started_at)) / 1000).toFixed(0) + 's…'
                  : '—'
              return (
                <tr key={job.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--accent)' }}>#{job.id}</span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <button className="btn btn-ghost btn-sm" style={{ padding: 0, fontSize: 13 }}
                      onClick={() => nav(`/datasets/${job.dataset_id}`)}>
                      DS #{job.dataset_id}
                    </button>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {statusIcon(job.status)}
                      <span style={{ textTransform: 'capitalize', color: STEP_COLORS[job.status] }}>{job.status}</span>
                    </div>
                    {job.error_message && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>{job.error_message.slice(0, 60)}</div>}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {(job.steps || []).map(s => <StepPill key={s.id} step={s} />)}
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: 12 }}>
                    {job.started_at ? new Date(job.started_at).toLocaleTimeString() : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: 12 }}>{dur}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {job.status === 'failed' && (
                        <button className="btn btn-outline btn-sm" onClick={() => retryJob(job.id)}>Retry</button>
                      )}
                      <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => deleteJob(job.id)}>
                        <XCircle size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {autoRefresh && jobs.some(j => j.status === 'running' || j.status === 'pending') && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>
          <Activity size={12} style={{ display: 'inline', marginRight: 4 }} /> Auto-refreshing every 4s…
        </div>
      )}
    </div>
  )
}
