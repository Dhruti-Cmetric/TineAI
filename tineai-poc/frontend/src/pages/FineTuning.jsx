import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, Play, RefreshCw, ChevronDown } from 'lucide-react'
import api from '../api/client'
import toast from 'react-hot-toast'

const LANGS = [
  'Yoruba', 'Swahili', 'Amharic', 'Hausa', 'Zulu', 'Igbo',
  'Cameroonian French', 'Nigerian English', 'Twi', 'Somali', 'Wolof',
]

const NLLB_CODES = {
  'Yoruba': 'yor_Latn', 'Swahili': 'swh_Latn', 'Amharic': 'amh_Ethi',
  'Hausa': 'hau_Latn', 'Zulu': 'zul_Latn', 'Igbo': 'ibo_Latn',
  'Cameroonian French': 'fra_Latn', 'Nigerian English': 'eng_Latn',
  'Twi': 'twi_Latn', 'Somali': 'som_Latn', 'Wolof': 'wol_Latn',
  'English': 'eng_Latn', 'French': 'fra_Latn',
}

const TASK_ICONS = {
  speech_to_text: '🎙️', diarization: '👥', translation: '🌐',
  text_understanding: '🧠', text_to_speech: '🔊', language_identification: '🗣️',
  ocr: '📄', video_processing: '🎬', quality_check: '✅', custom_training: '⚙️',
}

export default function FineTuning() {
  const [datasets, setDatasets] = useState([])
  const [models, setModels] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const nav = useNavigate()

  const [form, setForm] = useState({
    dataset_id: '',
    task_type: 'speech_to_text',
    src_lang: 'Yoruba',
    tgt_lang: 'English',
    understanding_task: 'classification',
    run_custom_training: false,
  })
  const [running, setRunning] = useState(false)

  async function load() {
    try {
      const [{ data: ds }, { data: m }, { data: j }] = await Promise.all([
        api.get('/datasets/?status=approved'),
        api.get('/models/'),
        api.get('/pipeline/jobs?limit=20'),
      ])
      setDatasets(ds)
      setModels(m)
      setJobs(j)
    } catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function runPipeline(e) {
    e.preventDefault()
    if (!form.dataset_id) return toast.error('Select a dataset')
    setRunning(true)
    try {
      const steps = ['quality_check', 'language_identification', 'speech_to_text',
        'diarization', 'translation', 'text_understanding', 'text_to_speech']
      if (form.run_custom_training) steps.push('custom_training')

      const payload = {
        steps,
        src_lang: NLLB_CODES[form.src_lang] || form.src_lang,
        tgt_lang: NLLB_CODES[form.tgt_lang] || 'eng_Latn',
        understanding_task: form.understanding_task,
      }
      const { data } = await api.post(`/pipeline/run/${form.dataset_id}`, payload)
      toast.success(`Pipeline started — Job #${data.job_id} (${data.mode})`)
      load()
      nav(`/datasets/${form.dataset_id}`)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to start pipeline')
    } finally { setRunning(false) }
  }

  // grouped by task_type for model overview
  const byTask = models.reduce((acc, m) => {
    if (m.is_default) acc[m.task_type] = m
    return acc
  }, {})

  if (loading) return <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Pipeline Configuration & Fine-tuning</h2>
          <p className="text-muted text-sm mt-2">Run full pipelines on approved datasets, configure steps, and trigger custom training</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* LEFT: run pipeline form */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Zap size={16} color="var(--accent)" />
              <span style={{ fontWeight: 700, fontSize: 15 }}>Run Pipeline</span>
            </div>
            <form onSubmit={runPipeline}>
              <div className="form-group">
                <label className="form-label">Dataset *</label>
                <select className="form-select" value={form.dataset_id} onChange={e => setForm(f => ({ ...f, dataset_id: e.target.value }))}>
                  <option value="">Select approved dataset…</option>
                  {datasets.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.language} · {d.data_type})</option>
                  ))}
                </select>
                {datasets.length === 0 && (
                  <div className="text-muted text-sm" style={{ marginTop: 4 }}>No approved datasets. Approve a dataset first.</div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Source Language</label>
                  <select className="form-select" value={form.src_lang} onChange={e => setForm(f => ({ ...f, src_lang: e.target.value }))}>
                    {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Translate To</label>
                  <select className="form-select" value={form.tgt_lang} onChange={e => setForm(f => ({ ...f, tgt_lang: e.target.value }))}>
                    {['English', 'French', ...LANGS].map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Text Understanding Task</label>
                <select className="form-select" value={form.understanding_task} onChange={e => setForm(f => ({ ...f, understanding_task: e.target.value }))}>
                  <option value="classification">Sentiment / Classification</option>
                  <option value="ner">Named Entity Recognition</option>
                  <option value="qa">Question Answering</option>
                  <option value="summarization">Summarization</option>
                </select>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.run_custom_training}
                    onChange={e => setForm(f => ({ ...f, run_custom_training: e.target.checked }))} />
                  <span style={{ fontSize: 13 }}>
                    <strong>Include Custom Training step</strong>
                    <span className="text-muted" style={{ marginLeft: 4 }}>(fine-tune selected model on this dataset)</span>
                  </span>
                </label>
              </div>

              <button className="btn btn-primary" type="submit" disabled={running || !form.dataset_id}
                style={{ width: '100%', justifyContent: 'center' }}>
                <Play size={14} /> {running ? 'Starting…' : 'Start Pipeline'}
              </button>
            </form>
          </div>

          {/* evaluation selection info */}
          <div className="card" style={{ background: 'var(--bg)' }}>
            <div className="card-title" style={{ marginBottom: 10 }}>Model Selection Approach</div>
            {[
              ['1', 'Start with pretrained models (no training from scratch)'],
              ['2', 'Test on real TINE AI datasets using pipeline above'],
              ['3', 'Native-speaker human validation (HumanReview)'],
              ['4', 'Set winning model as default in Model Registry'],
              ['5', 'Fine-tune with Custom Training on approved data'],
              ['6', 'Production deployment — model-agnostic, swappable anytime'],
            ].map(([n, t]) => (
              <div key={n} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ fontWeight: 800, color: 'var(--accent)', minWidth: 18 }}>{n}</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: active defaults + recent jobs */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontWeight: 600 }}>Active Default Models</span>
              <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', fontSize: 12 }} onClick={() => nav('/models')}>
                Manage →
              </button>
            </div>
            {Object.entries(byTask).length === 0 && (
              <div className="text-muted text-sm">No models seeded yet. Go to Model Registry → Seed Defaults.</div>
            )}
            {Object.entries(byTask).map(([tt, m]) => (
              <div key={tt} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                <span>{TASK_ICONS[tt] || '🔧'} <span style={{ color: 'var(--muted)' }}>{tt.replace(/_/g, ' ')}</span></span>
                <span style={{ fontWeight: 600 }}>{m.name}</span>
              </div>
            ))}
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 600 }}>Recent Pipeline Jobs</span>
              <button className="btn btn-ghost btn-sm" onClick={() => nav('/pipeline')} style={{ fontSize: 12 }}>View All →</button>
            </div>
            {jobs.length === 0 && <div className="text-muted text-sm">No jobs yet.</div>}
            {jobs.slice(0, 8).map(job => (
              <div key={job.id} style={{
                display: 'flex', justifyContent: 'space-between', padding: '7px 0',
                borderBottom: '1px solid var(--border)', fontSize: 12
              }}>
                <div>
                  <button className="btn btn-ghost btn-sm" style={{ padding: 0, fontSize: 12, fontWeight: 700 }}
                    onClick={() => nav(`/datasets/${job.dataset_id}`)}>
                    Job #{job.id} · DS #{job.dataset_id}
                  </button>
                  <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
                    {(job.steps || []).length} steps
                    {job.started_at ? ` · ${new Date(job.started_at).toLocaleTimeString()}` : ''}
                  </div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8, alignSelf: 'flex-start',
                  background: { completed: '#d1fae5', failed: '#fee2e2', running: '#fef3c7', pending: '#f1f5f9' }[job.status] || '#f1f5f9',
                  color: { completed: '#065f46', failed: '#b91c1c', running: '#92400e', pending: '#475569' }[job.status] || '#475569',
                }}>
                  {job.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
