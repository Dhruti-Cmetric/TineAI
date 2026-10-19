import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Globe2, Lock, Mail, ArrowRight, ShieldCheck, User, Building, Database } from 'lucide-react'
import api from '../api/client'
import toast from 'react-hot-toast'

export default function Login() {
  const [email, setEmail] = useState('admin@tineai.com')
  const [password, setPassword] = useState('admin123')
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
      toast.success(`Authenticated as ${data.name}`)
      nav('/')
    } catch {
      toast.error('Authentication failed: Please check your credentials')
    } finally {
      setLoading(false)
    }
  }

  const portalPersonas = [
    {
      role: 'Administrator',
      email: 'admin@tineai.com',
      pw: 'admin123',
      color: '#dc2626',
      icon: ShieldCheck,
      desc: 'Platform governance, AI pipelines & model registry'
    },
    {
      role: 'Data Supplier / Vendor',
      email: 'supplier@tineai.com',
      pw: 'supplier123',
      color: '#d97706',
      icon: Database,
      desc: 'Dataset contributor uploads, licensing & royalty tracking'
    },
    {
      role: 'Enterprise Client',
      email: 'client@aichina.ai',
      pw: 'client123',
      color: '#2563eb',
      icon: Building,
      desc: 'Commercial marketplace, token downloads & API keys'
    },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at top, #1e3a8a 0%, #0b1329 65%, #050a17 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 28, color: '#fff' }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
            boxShadow: '0 8px 24px rgba(37, 99, 235, 0.4)'
          }}>
            <Globe2 size={30} color="#fff" />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.3px', marginBottom: 6 }}>TINE AI</h1>
          <p style={{ color: '#94a3b8', fontSize: 13.5, lineHeight: 1.5 }}>
            Enterprise Multilingual AI & Speech Data Infrastructure
          </p>
        </div>

        {/* Authentication Card */}
        <div className="card" style={{ boxShadow: '0 20px 40px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Mail size={14} /> Corporate Email
              </label>
              <input
                className="form-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Lock size={14} /> Password
              </label>
              <input
                className="form-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
            </div>

            <button
              className="btn btn-primary w-full btn-lg"
              style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
              disabled={loading}
            >
              {loading ? (
                <span className="spinner" />
              ) : (
                <>
                  <span>Sign In to Portal</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Quick Persona Selector */}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, textAlign: 'center' }}>
              Switch Portal Account
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {portalPersonas.map(p => {
                const isSelected = email === p.email
                return (
                  <button
                    key={p.role}
                    type="button"
                    onClick={() => { setEmail(p.email); setPassword(p.pw) }}
                    className="btn btn-outline"
                    style={{
                      justifyContent: 'flex-start',
                      padding: '8px 12px',
                      background: isSelected ? 'var(--surface-raised)' : 'transparent',
                      borderColor: isSelected ? p.color : 'var(--border)',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: `${p.color}18`,
                      color: p.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <p.icon size={15} />
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: isSelected ? p.color : 'var(--text)' }}>
                        {p.role}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.desc}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#64748b' }}>
          Secure End-to-End Enterprise African Data Governance
        </div>
      </div>
    </div>
  )
}
