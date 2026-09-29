import { useEffect, useState } from 'react'
import { UserPlus, ToggleLeft, ToggleRight } from 'lucide-react'
import api from '../api/client'
import toast from 'react-hot-toast'

export default function Users() {
  const [users, setUsers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'supplier' })
  const [loading, setLoading] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await api.get('/users/')
    setUsers(data)
  }

  async function createUser(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/users/', form)
      toast.success('User created')
      setShowForm(false)
      setForm({ name: '', email: '', password: '', role: 'supplier' })
      load()
    } catch(err) {
      toast.error(err.response?.data?.detail || 'Error')
    } finally { setLoading(false) }
  }

  async function toggleUser(id) {
    await api.patch(`/users/${id}/toggle`)
    load()
  }

  const roleColors = { admin: '#dc2626', supplier: '#d97706', client: '#1a56db' }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>User Management</h2>
          <p className="text-muted text-sm mt-2">{users.length} users registered</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>
          <UserPlus size={14} /> Add User
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom:20 }}>
          <div className="card-title">New User</div>
          <form onSubmit={createUser}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input className="form-input" type="password" value={form.password} onChange={e => setForm(f=>({...f,password:e.target.value}))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-select" value={form.role} onChange={e => setForm(f=>({...f,role:e.target.value}))}>
                  <option value="supplier">Supplier</option>
                  <option value="client">Client</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-primary" type="submit" disabled={loading}>Create User</button>
              <button className="btn btn-outline" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:32, height:32, borderRadius:'50%', background: roleColors[u.role] || '#64748b', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:600, fontSize:12 }}>
                        {u.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                      </div>
                      {u.name}
                    </div>
                  </td>
                  <td className="text-muted">{u.email}</td>
                  <td><span className={`badge badge-${u.role}`}>{u.role}</span></td>
                  <td>
                    <span style={{ color: u.is_active ? 'var(--success)' : 'var(--danger)', fontWeight:500, fontSize:13 }}>
                      {u.is_active ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td className="text-muted">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => toggleUser(u.id)}>
                      {u.is_active ? <ToggleRight size={16} color="var(--success)" /> : <ToggleLeft size={16} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
