import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Upload, Database, Users, Key, ClipboardList,
  LogOut, Globe, ShieldCheck, UserCheck, FileText, CheckSquare,
  Briefcase, ShieldAlert, GitBranch
} from 'lucide-react'

const role = () => localStorage.getItem('role')
const userName = () => localStorage.getItem('name') || 'User'

const navItems = [
  { label: 'Dashboard',        path: '/',                  icon: LayoutDashboard, roles: ['admin', 'supplier', 'client'] },
  { label: 'Datasets',         path: '/datasets',          icon: Database,        roles: ['admin', 'supplier', 'client'] },
  { label: 'Upload Data',      path: '/upload',            icon: Upload,          roles: ['admin', 'supplier'] },
  { label: 'Create Data Card', path: '/datacard/create',   icon: FileText,        roles: ['admin', 'supplier'] },
  { label: 'Approvals Queue',  path: '/approvals',         icon: CheckSquare,     roles: ['admin'] },
  { label: 'Projects & Licenses', path: '/projects',       icon: Briefcase,       roles: ['admin', 'client'] },
  { label: 'Users',            path: '/users',             icon: Users,           roles: ['admin'] },
  { label: 'Assignments',      path: '/assignments',       icon: UserCheck,       roles: ['admin'] },
  { label: 'Client Portal',    path: '/client-portal',     icon: Globe,           roles: ['admin', 'client'] },
  { label: 'API Access',       path: '/api-access',        icon: Key,             roles: ['admin', 'client'] },
  { label: 'Access Control',   path: '/access-control',    icon: ShieldAlert,     roles: ['admin', 'client'] },
  { label: 'Audit Log',        path: '/audit',             icon: ClipboardList,   roles: ['admin'] },
]

export default function Layout() {
  const nav = useNavigate()
  const loc = useLocation()
  const r = role()
  const initials = userName().split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
  const roleColors = { admin: '#dc2626', supplier: '#d97706', client: '#1a56db' }

  function logout() {
    localStorage.clear()
    nav('/login')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:24 }}>🌍</span>
            <div>
              <h1>TINE AI</h1>
              <span>Data Platform</span>
            </div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section">Navigation</div>
          {navItems.filter(i => i.roles.includes(r)).map(item => (
            <button
              key={item.path}
              className={`nav-item ${loc.pathname === item.path || (item.path !== '/' && loc.pathname.startsWith(item.path)) ? 'active' : ''}`}
              onClick={() => nav(item.path)}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
            <div className="avatar" style={{ background: roleColors[r] || '#64748b', color:'#fff', fontSize:12 }}>{initials}</div>
            <div>
              <div style={{ fontSize:13, color:'#e2e8f0', fontWeight:500 }}>{userName()}</div>
              <div style={{ fontSize:11, color:'#64748b', textTransform:'capitalize' }}>{r}</div>
            </div>
          </div>
          <button className="nav-item" style={{ padding:'6px 0', color:'#ef4444' }} onClick={logout}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>
      <div className="main-content">
        <header className="topbar">
          <span className="topbar-title">🌍 TINE AI Data Platform <span style={{fontSize:11, color:'var(--muted)', marginLeft:8}}>POC Demo</span></span>
          <div className="topbar-user">
            <ShieldCheck size={14} color="var(--success)" />
            <span style={{ fontSize:12, color:'var(--muted)' }}>TINE AI Controlled</span>
          </div>
        </header>
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
