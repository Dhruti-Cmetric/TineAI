import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Upload, Database, Users, Key, ClipboardList,
  LogOut, Globe2, ShieldCheck, UserCheck, FileText, CheckSquare,
  Briefcase, ShieldAlert, Cpu, Activity, Sliders, ChevronRight
} from 'lucide-react'

const role = () => localStorage.getItem('role')
const userName = () => localStorage.getItem('name') || 'User'

const navGroups = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['admin', 'supplier', 'client'] },
      { label: 'Client Portal', path: '/client-portal', icon: Globe2, roles: ['admin', 'client'] },
    ]
  },
  {
    title: 'Data Operations',
    items: [
      { label: 'Datasets Catalog', path: '/datasets', icon: Database, roles: ['admin', 'supplier', 'client'] },
      { label: 'Upload Data', path: '/upload', icon: Upload, roles: ['admin', 'supplier'] },
      { label: 'Create Data Card', path: '/datacard/create', icon: FileText, roles: ['admin', 'supplier'] },
    ]
  },
  {
    title: 'AI & Pipelines',
    items: [
      { label: 'Model Registry', path: '/models', icon: Cpu, roles: ['admin', 'supplier'] },
      { label: 'Pipeline Monitor', path: '/pipeline', icon: Activity, roles: ['admin', 'supplier'] },
      { label: 'Fine-tuning Hub', path: '/finetuning', icon: Sliders, roles: ['admin'] },
      { label: 'Approvals Queue', path: '/approvals', icon: CheckSquare, roles: ['admin'] },
    ]
  },
  {
    title: 'Enterprise Governance',
    items: [
      { label: 'Projects & Licenses', path: '/projects', icon: Briefcase, roles: ['admin', 'client'] },
      { label: 'User Management', path: '/users', icon: Users, roles: ['admin'] },
      { label: 'Client Assignments', path: '/assignments', icon: UserCheck, roles: ['admin'] },
      { label: 'API Keys & Access', path: '/api-access', icon: Key, roles: ['admin', 'client'] },
      { label: 'Policy & Compliance', path: '/access-control', icon: ShieldAlert, roles: ['admin', 'client'] },
      { label: 'Audit Trail', path: '/audit', icon: ClipboardList, roles: ['admin'] },
    ]
  }
]

export default function Layout() {
  const nav = useNavigate()
  const loc = useLocation()
  const r = role()
  const initials = userName().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  const roleLabels = {
    admin: 'Platform Administrator',
    supplier: 'Data Supplier / Vendor',
    client: 'Enterprise Client'
  }

  const roleColors = {
    admin: '#dc2626',
    supplier: '#d97706',
    client: '#2563eb'
  }

  function logout() {
    localStorage.clear()
    nav('/login')
  }

  return (
    <div className="app-shell">
      {/* ── SIDEBAR ────────────────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="logo-badge">
              <Globe2 size={20} />
            </div>
            <div>
              <h1>TINE AI</h1>
              <span>Enterprise Data Platform</span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navGroups.map(group => {
            const accessible = group.items.filter(i => i.roles.includes(r))
            if (accessible.length === 0) return null
            return (
              <div key={group.title} style={{ marginBottom: 12 }}>
                <div className="nav-section">{group.title}</div>
                {accessible.map(item => {
                  const isActive = loc.pathname === item.path ||
                    (item.path !== '/' && loc.pathname.startsWith(item.path))
                  return (
                    <button
                      key={item.path}
                      className={`nav-item ${isActive ? 'active' : ''}`}
                      onClick={() => nav(item.path)}
                    >
                      <item.icon size={16} />
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {isActive && <ChevronRight size={14} style={{ opacity: 0.7 }} />}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-badge">
            <div
              className="avatar"
              style={{
                background: roleColors[r] || '#475569',
                color: '#fff',
                fontSize: 12
              }}
            >
              {initials}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {userName()}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                {roleLabels[r] || r}
              </div>
            </div>
          </div>
          <button
            className="nav-item"
            style={{ padding: '7px 12px', color: '#f87171', background: 'rgba(239, 68, 68, 0.08)' }}
            onClick={logout}
          >
            <LogOut size={14} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ───────────────────────────────────────────────────── */}
      <div className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <span className="topbar-title">TINE AI Data Platform</span>
            <span className="topbar-badge">
              <span className="pulse-dot"></span>
              AI Cluster Active
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
              <ShieldCheck size={16} color="var(--success)" />
              <span>Enterprise Governance Verified</span>
            </div>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
