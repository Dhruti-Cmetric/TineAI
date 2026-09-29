import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload as UploadIcon } from 'lucide-react'
import api from '../api/client'
import toast from 'react-hot-toast'

export default function Upload() {
  const nav = useNavigate()
  const [form, setForm] = useState({
    name: '', description: '', data_type: 'audio', language: '', country: '',
    dialect: '', cultural_context: '', source: '', rights_info: '', permitted_uses: ''
  })
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)

  function update(k, v) { setForm(f => ({...f, [k]: v})) }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      if (file) fd.append('file', file)
      await api.post('/datasets/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Dataset uploaded successfully!')
      nav('/datasets')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed')
    } finally { setLoading(false) }
  }

  const langs = ['Yoruba', 'Swahili', 'Amharic', 'Hausa', 'Zulu', 'Igbo', 'Cameroonian French', 'Nigerian English', 'Twi', 'Somali', 'Other']
  const countries = ['Nigeria', 'Kenya', 'Ethiopia', 'Ghana', 'South Africa', 'Cameroon', 'Tanzania', 'Uganda', 'Senegal', 'Egypt', 'Other']

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Upload Dataset</h2>
          <p className="text-muted text-sm mt-2">Upload audio, video or image files with metadata to the platform</p>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:20 }}>
        <form onSubmit={handleSubmit}>
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-title">Dataset Information</div>
            <div className="form-group">
              <label className="form-label">Dataset Name *</label>
              <input className="form-input" value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g. Yoruba Morning Conversations" required />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" value={form.description} onChange={e => update('description', e.target.value)} placeholder="Describe the dataset content, collection method, intended use..." />
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Data Type *</label>
                <select className="form-select" value={form.data_type} onChange={e => update('data_type', e.target.value)}>
                  <option value="audio">Audio</option>
                  <option value="video">Video</option>
                  <option value="image">Image</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Language *</label>
                <select className="form-select" value={form.language} onChange={e => update('language', e.target.value)} required>
                  <option value="">Select language...</option>
                  {langs.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Country/Region *</label>
                <select className="form-select" value={form.country} onChange={e => update('country', e.target.value)} required>
                  <option value="">Select country...</option>
                  {countries.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Dialect / Accent</label>
                <input className="form-input" value={form.dialect} onChange={e => update('dialect', e.target.value)} placeholder="e.g. Lagos Yoruba, Camfranglais" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Cultural Context</label>
              <input className="form-input" value={form.cultural_context} onChange={e => update('cultural_context', e.target.value)} placeholder="e.g. Urban market, rural agricultural, broadcast media..." />
            </div>
            <div className="form-group">
              <label className="form-label">Data Source</label>
              <input className="form-input" value={form.source} onChange={e => update('source', e.target.value)} placeholder="e.g. Community field recordings — Lagos, 2025" />
            </div>
          </div>

          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-title">Rights & Licensing</div>
            <div className="form-group">
              <label className="form-label">Rights Information</label>
              <textarea className="form-textarea" value={form.rights_info} onChange={e => update('rights_info', e.target.value)} placeholder="e.g. TINE AI owns all rights. Licensed for AI training only." style={{ minHeight:60 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Permitted Uses</label>
              <input className="form-input" value={form.permitted_uses} onChange={e => update('permitted_uses', e.target.value)} placeholder="e.g. AI model training, dialect research, speech recognition" />
            </div>
          </div>

          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-title">File Upload</div>
            <div
              style={{ border:'2px dashed var(--border)', borderRadius:'var(--radius-lg)', padding:32, textAlign:'center', cursor:'pointer', background: file ? 'var(--success-light)' : 'var(--bg)' }}
              onClick={() => document.getElementById('fileInput').click()}
            >
              <UploadIcon size={32} color="var(--muted)" style={{ margin:'0 auto 8px' }} />
              {file ? (
                <div style={{ color:'var(--success)', fontWeight:500 }}>
                  ✓ {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
                </div>
              ) : (
                <>
                  <div style={{ fontWeight:500, marginBottom:4 }}>Click to select a file</div>
                  <div className="text-muted text-sm">Audio (wav, mp3), Video (mp4), Images (jpg, png)</div>
                </>
              )}
              <input id="fileInput" type="file" style={{ display:'none' }} accept="audio/*,video/*,image/*"
                onChange={e => setFile(e.target.files[0])} />
            </div>
            <p className="text-muted text-sm" style={{ marginTop:8 }}>File is optional for demo — metadata-only datasets are supported.</p>
          </div>

          <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ width:'100%', justifyContent:'center' }}>
            {loading ? <><span className="spinner" /> Uploading...</> : <><UploadIcon size={16} /> Upload Dataset</>}
          </button>
        </form>

        <div>
          <div className="card">
            <div className="card-title">What happens next?</div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[
                ['1', 'Uploaded', 'Your dataset enters the TINE AI platform in Uploaded status.', '#1a56db'],
                ['2', 'Processing', 'Admin assigns AI processing — transcription, annotation, dialect tagging.', '#7c3aed'],
                ['3', 'Under Review', 'Human reviewers verify quality, accuracy and compliance.', '#d97706'],
                ['4', 'Approved', 'TINE AI gives final approval before any client access.', '#059669'],
              ].map(([n, label, desc, color]) => (
                <div key={n} style={{ display:'flex', gap:12 }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:color, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:13, flexShrink:0 }}>{n}</div>
                  <div>
                    <div style={{ fontWeight:600, fontSize:13 }}>{label}</div>
                    <div className="text-muted text-sm">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
