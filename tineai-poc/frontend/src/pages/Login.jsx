import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import toast from 'react-hot-toast'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const form = new URLSearchParams()
      form.append('username', email)
      form.append('password', password)
      const { data } = await api.post('/auth/token', form)
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('role', data.role)
      localStorage.setItem('name', data.name)
      localStorage.setItem('userId', data.id)
      toast.success(`Welcome, ${data.name}!`)
      nav('/')
    } catch {
      toast.error('Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  const demoUsers = [
    { label: 'Admin', email: 'admin@tineai.com', pw: 'admin123', color: '#dc2626' },
    { label: 'Supplier', email: 'supplier@tineai.com', pw: 'supplier123', color: '#d97706' },
    { label: 'Client', email: 'client@aichina.ai', pw: 'client123', color: '#1a56db' },
  ]

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ width:'100%', maxWidth:420 }}>
        <div style={{ textAlign:'center', marginBottom:32, color:'#fff' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>🌍</div>
          <h1 style={{ fontSize:28, fontWeight:700, marginBottom:4 }}>TINE AI</h1>
          <p style={{ color:'#94a3b8', fontSize:14 }}>African Data Platform — POC Demo</p>
        </div>

        <div className="card">
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter email" required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" required />
            </div>
            <button className="btn btn-primary w-full btn-lg" style={{ width:'100%', justifyContent:'center' }} disabled={loading}>
              {loading ? <span className="spinner" /> : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop:24 }}>
            <div style={{ fontSize:12, color:'var(--muted)', marginBottom:10, textAlign:'center' }}>Demo accounts — click to auto-fill</div>
            <div style={{ display:'flex', gap:8 }}>
              {demoUsers.map(u => (
                <button key={u.label} className="btn btn-outline" style={{ flex:1, justifyContent:'center', fontSize:12, borderColor: u.color, color: u.color }}
                  onClick={() => { setEmail(u.email); setPassword(u.pw) }}>
                  {u.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
