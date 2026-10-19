import { useEffect, useState } from 'react'
import { Cpu, Star, RefreshCw, CheckCircle, Plus, X, ChevronDown, ChevronUp } from 'lucide-react'
import api from '../api/client'
import toast from 'react-hot-toast'

const TASK_LABELS = {
  speech_to_text: 'Speech-to-Text',
  diarization: 'Speaker Diarization',
  translation: 'Translation',
  speech_translation: 'Speech Translation',
  text_understanding: 'Text Understanding',
  text_to_speech: 'Text-to-Speech',
  language_identification: 'Language ID',
  ocr: 'OCR',
  image_annotation: 'Image Annotation',
  video_processing: 'Video Processing',
  quality_check: 'Quality Check',
  custom_training: 'Custom Training',
}

const TASK_ICONS = {
  speech_to_text: '🎙️', diarization: '👥', translation: '🌐',
  speech_translation: '🔄', text_understanding: '🧠', text_to_speech: '🔊',
  language_identification: '🗣️', ocr: '📄', image_annotation: '🖼️',
  video_processing: '🎬', quality_check: '✅', custom_training: '⚙️',
}

const PROVIDER_COLORS = {
  openai: '#10b981', meta: '#1877f2', huggingface: '#ff9500',
  papluca: '#8b5cf6', pyannote: '#ec4899', tineai: '#3b82f6',
  tesseract: '#64748b', cvat: '#f59e0b', local: '#94a3b8',
}

export default function ModelRegistry() {
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [expanded, setExpanded] = useState({})
  const role = localStorage.getItem('role')
  const [form, setForm] = useState({
    name: '', task_type: 'speech_to_text', provider: '', hf_model_id: '',
    language_support: 'all', is_default: false, notes: '',
  })

  async function load() {
    try {
      const { data } = await api.get('/models/?active_only=false')
      setModels(data)
    } catch { toast.error('Failed to load models') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function setDefault(id) {
    try {
      await api.post(`/models/${id}/set-default`)
      toast.success('Default model updated')
      load()
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed') }
  }

  async function deactivate(id) {
    try {
      await api.delete(`/models/${id}`)
      toast.success('Model deactivated')
      load()
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed') }
  }

  async function seedDefaults() {
    try {
      const { data } = await api.post('/models/seed-defaults')
      const created = data.seeded.filter(s => s.action === 'created').length
      toast.success(`Seeded ${created} new default models`)
      load()
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed') }
  }

  async function addModel(e) {
    e.preventDefault()
    try {
      await api.post('/models/', form)
      toast.success('Model registered')
      setShowAdd(false)
      setForm({ name: '', task_type: 'speech_to_text', provider: '', hf_model_id: '', language_support: 'all', is_default: false, notes: '' })
      load()
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed') }
  }

  // group by task_type
  const grouped = models
    .filter(m => !filter || m.task_type.includes(filter) || m.name.toLowerCase().includes(filter.toLowerCase()))
    .reduce((acc, m) => { (acc[m.task_type] = acc[m.task_type] || []).push(m); return acc }, {})

  if (loading) return <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Model Registry</h2>
          <p className="text-muted text-sm mt-2">Manage AI models for each pipeline task type — swap models without code changes</p>
        </div>
        {role === 'admin' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={seedDefaults}><RefreshCw size={13} /> Seed Defaults</button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(v => !v)}><Plus size={13} /> Register Model</button>
          </div>
        )}
      </div>

      {/* search */}
      <input className="form-input" placeholder="Filter by task or name…" value={filter}
        onChange={e => setFilter(e.target.value)} style={{ maxWidth: 340, marginBottom: 20 }} />

      {/* add form */}
      {showAdd && role === 'admin' && (
        <div className="card" style={{ marginBottom: 20, border: '2px solid var(--accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <strong>Register New Model</strong>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}><X size={14} /></button>
          </div>
          <form onSubmit={addModel}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Name *</label>
                <input className="form-input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Task Type *</label>
                <select className="form-select" value={form.task_type} onChange={e => setForm(f => ({ ...f, task_type: e.target.value }))}>
                  {Object.keys(TASK_LABELS).map(t => <option key={t} value={t}>{TASK_LABELS[t]}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Provider</label>
                <input className="form-input" value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} placeholder="meta / openai / …" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 10 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">HuggingFace Model ID</label>
                <input className="form-input" value={form.hf_model_id} onChange={e => setForm(f => ({ ...f, hf_model_id: e.target.value }))} placeholder="e.g. openai/whisper-large-v3" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Language Support</label>
                <input className="form-input" value={form.language_support} onChange={e => setForm(f => ({ ...f, language_support: e.target.value }))} placeholder="all / yor,swa,amh" />
              </div>
            </div>
            <div className="form-group" style={{ margin: '0 0 10px' }}>
              <label className="form-label">Notes</label>
              <input className="form-input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <input type="checkbox" checked={form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} />
                Set as default for this task type
              </label>
              <button className="btn btn-primary btn-sm" type="submit">Save</button>
            </div>
          </form>
        </div>
      )}

      {/* grouped task cards */}
      {Object.entries(grouped).map(([taskType, mods]) => (
        <div className="card" key={taskType} style={{ marginBottom: 12 }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setExpanded(ex => ({ ...ex, [taskType]: !ex[taskType] }))}
          >
            <span style={{ fontSize: 20 }}>{TASK_ICONS[taskType] || '🔧'}</span>
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{TASK_LABELS[taskType] || taskType}</span>
              <span className="text-muted text-sm" style={{ marginLeft: 8 }}>{mods.length} model{mods.length !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {mods.filter(m => m.is_default).map(m => (
                <span key={m.id} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#d1fae5', color: '#065f46', fontWeight: 600 }}>
                  ✓ {m.name}
                </span>
              ))}
            </div>
            {expanded[taskType] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>

          {expanded[taskType] && (
            <div style={{ marginTop: 12 }}>
              {mods.map(m => (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  borderRadius: 6, background: m.is_default ? 'var(--accent-light)' : 'var(--bg)',
                  marginBottom: 6, border: m.is_default ? '1px solid var(--accent)' : '1px solid var(--border)'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</span>
                      {m.is_default && <span style={{ fontSize: 10, background: '#10b981', color: '#fff', padding: '1px 6px', borderRadius: 8, fontWeight: 700 }}>DEFAULT</span>}
                      {!m.is_active && <span style={{ fontSize: 10, background: '#ef4444', color: '#fff', padding: '1px 6px', borderRadius: 8 }}>INACTIVE</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {m.hf_model_id && <span style={{ marginRight: 10 }}>🤗 {m.hf_model_id}</span>}
                      {m.provider && (
                        <span style={{ padding: '1px 7px', borderRadius: 8, fontSize: 11, background: PROVIDER_COLORS[m.provider] + '22', color: PROVIDER_COLORS[m.provider], fontWeight: 600, marginRight: 8 }}>
                          {m.provider}
                        </span>
                      )}
                      {m.language_support && <span>langs: {m.language_support}</span>}
                    </div>
                    {m.notes && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{m.notes}</div>}
                  </div>
                  {role === 'admin' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      {!m.is_default && (
                        <button className="btn btn-outline btn-sm" onClick={() => setDefault(m.id)} title="Set as default">
                          <Star size={12} /> Default
                        </button>
                      )}
                      {m.is_active && (
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deactivate(m.id)} title="Deactivate">
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {Object.keys(grouped).length === 0 && (
        <div className="empty-state">
          No models found.{role === 'admin' && <> Click <strong>Seed Defaults</strong> to populate the registry.</>}
        </div>
      )}
    </div>
  )
}
