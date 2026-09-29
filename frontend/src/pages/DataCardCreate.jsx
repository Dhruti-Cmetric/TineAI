import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, CheckCircle } from 'lucide-react'
import api from '../api/client'
import toast from 'react-hot-toast'

const LANGS = ['Yoruba', 'Swahili', 'Amharic', 'Hausa', 'Zulu', 'Igbo', 'Cameroonian French',
  'Nigerian English', 'Twi', 'Somali', 'Wolof', 'Tigrinya', 'Shona', 'Xhosa', 'Other']
const COUNTRIES = ['Nigeria', 'Kenya', 'Ethiopia', 'Ghana', 'South Africa', 'Cameroon',
  'Tanzania', 'Uganda', 'Senegal', 'Egypt', 'Morocco', 'Zimbabwe', 'Other']
const USES = ['AI model training', 'Speech recognition improvement', 'Dialect research',
  'Translation model training', 'Cultural alignment', 'Academic research', 'Benchmark dataset']

export default function DataCardCreate() {
  const nav = useNavigate()
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    name: '', description: '', data_type: 'audio',
    language: '', country: '', dialect: '', cultural_context: '',
    source: '', rights_info: '', permitted_uses: '',
    annotation_details: '', version: '1.0',
    file_formats: '', file_size_mb: 0,
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      const { data } = await api.post('/datasets/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setSaved(true)
      toast.success('Data Card created!')
      setTimeout(() => nav(`/datasets/${data.id}`), 1200)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create Data Card')
    }
  }

  const fields = [
    { label: 'Dataset Name *', key: 'name', type: 'input', placeholder: 'e.g. Yoruba Morning Conversations' },
    { label: 'Description', key: 'description', type: 'textarea', placeholder: 'Describe the dataset content, collection method and intended use...' },
  ]

  if (saved) return (
    <div style={{ textAlign: 'center', padding: 64 }}>
      <CheckCircle size={48} color="var(--success)" style={{ margin: '0 auto 16px' }} />
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Data Card Created</h2>
      <p className="text-muted">Redirecting to dataset detail...</p>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Create Data Card</h2>
          <p className="text-muted text-sm mt-2">Register a new African dataset with full metadata — no file required at this stage</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        <form onSubmit={handleSubmit}>

          {/* Identity */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={16} color="var(--accent)" /> Dataset Identity
            </div>
            <div className="form-group">
              <label className="form-label">Dataset Name *</label>
              <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Yoruba Morning Conversations" required />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe the content, collection method, recording conditions, speaker demographics..." />
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Data Type *</label>
                <select className="form-select" value={form.data_type} onChange={e => set('data_type', e.target.value)}>
                  <option value="audio">Audio</option>
                  <option value="video">Video</option>
                  <option value="image">Image</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Version</label>
                <input className="form-input" value={form.version} onChange={e => set('version', e.target.value)} placeholder="1.0" />
              </div>
              <div className="form-group">
                <label className="form-label">File Formats</label>
                <input className="form-input" value={form.file_formats} onChange={e => set('file_formats', e.target.value)} placeholder="wav, mp3, mp4, jpg..." />
              </div>
              <div className="form-group">
                <label className="form-label">Approx. Size (MB)</label>
                <input className="form-input" type="number" value={form.file_size_mb} onChange={e => set('file_size_mb', e.target.value)} placeholder="0" />
              </div>
            </div>
          </div>

          {/* Language & Region */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              🌍 Language & Regional Information
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Language *</label>
                <select className="form-select" value={form.language} onChange={e => set('language', e.target.value)} required>
                  <option value="">Select language...</option>
                  {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Country / Region *</label>
                <select className="form-select" value={form.country} onChange={e => set('country', e.target.value)} required>
                  <option value="">Select country...</option>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Dialect / Accent</label>
                <input className="form-input" value={form.dialect} onChange={e => set('dialect', e.target.value)} placeholder="e.g. Lagos Yoruba, Camfranglais, KZN Zulu" />
              </div>
              <div className="form-group">
                <label className="form-label">Data Source</label>
                <input className="form-input" value={form.source} onChange={e => set('source', e.target.value)} placeholder="e.g. Community recordings — Lagos, 2025" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Cultural Context</label>
              <input className="form-input" value={form.cultural_context} onChange={e => set('cultural_context', e.target.value)} placeholder="e.g. Urban market speech, rural agricultural training, broadcast media, oral literature..." />
            </div>
          </div>

          {/* Quality & Annotation */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title">Quality & Annotation Details</div>
            <div className="form-group">
              <label className="form-label">Annotation Details</label>
              <textarea className="form-textarea" value={form.annotation_details} onChange={e => set('annotation_details', e.target.value)} placeholder="e.g. Speaker diarization complete. 3 speakers per clip. Sentence-level transcription. Confidence scores attached." style={{ minHeight: 70 }} />
            </div>
          </div>

          {/* Rights */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title">Rights & Licensing</div>
            <div className="form-group">
              <label className="form-label">Rights & Ownership</label>
              <textarea className="form-textarea" value={form.rights_info} onChange={e => set('rights_info', e.target.value)} placeholder="e.g. TINE AI owns all rights. Licensed for AI training only. Non-commercial." style={{ minHeight: 60 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Permitted Uses</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {USES.map(u => (
                  <button key={u} type="button"
                    style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, border: '1px solid var(--border)', cursor: 'pointer', background: form.permitted_uses.includes(u) ? 'var(--accent)' : 'var(--bg)', color: form.permitted_uses.includes(u) ? '#fff' : 'var(--muted)' }}
                    onClick={() => {
                      const cur = form.permitted_uses ? form.permitted_uses.split(', ').filter(Boolean) : []
                      const next = cur.includes(u) ? cur.filter(x => x !== u) : [...cur, u]
                      set('permitted_uses', next.join(', '))
                    }}>
                    {u}
                  </button>
                ))}
              </div>
              <input className="form-input" value={form.permitted_uses} onChange={e => set('permitted_uses', e.target.value)} placeholder="or type custom permitted uses..." />
            </div>
          </div>

          <button className="btn btn-primary btn-lg" type="submit" style={{ width: '100%', justifyContent: 'center' }}>
            <FileText size={16} /> Create Data Card
          </button>
        </form>

        {/* Preview panel */}
        <div>
          <div className="card" style={{ position: 'sticky', top: 72 }}>
            <div className="card-title">Data Card Preview</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['Name', form.name || '—'],
                ['Type', form.data_type],
                ['Language', form.language || '—'],
                ['Country', form.country || '—'],
                ['Dialect', form.dialect || '—'],
                ['Cultural Context', form.cultural_context || '—'],
                ['Source', form.source || '—'],
                ['Formats', form.file_formats || '—'],
                ['Version', `v${form.version}`],
                ['Rights', form.rights_info ? form.rights_info.slice(0, 60) + (form.rights_info.length > 60 ? '...' : '') : '—'],
                ['Permitted Uses', form.permitted_uses || '—'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                  <span className="text-muted">{k}</span>
                  <span style={{ fontWeight: 500, textAlign: 'right', maxWidth: 160 }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--warning-light)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--warning)' }}>
              Status will be set to <strong>Uploaded</strong> on creation. TINE AI Admin must approve before client access.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
