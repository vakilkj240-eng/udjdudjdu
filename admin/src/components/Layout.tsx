import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FileText, Layers, BookOpen, Scale, Gavel,
  Users, Settings, LogOut, Menu, X, Workflow
} from 'lucide-react'
import { useState } from 'react'
import { clearToken } from '../lib/auth'

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/pipeline', label: 'PDF Pipeline', icon: Workflow },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/chunks', label: 'Chunks', icon: Layers },
  { to: '/sources', label: 'Sources', icon: BookOpen },
  { to: '/cases', label: 'Cases', icon: Scale },
  { to: '/acts', label: 'Acts', icon: Gavel },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const navigate = useNavigate()

  function logout() {
    clearToken()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`flex flex-col bg-surface-1 border-r border-white/[0.08] transition-all duration-300 ${
          sidebarOpen ? 'w-60' : 'w-16'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/[0.08]">
          <img src="/logo-circular.png" alt="Gavel & Brief"
            className="w-9 h-9 object-contain flex-shrink-0"
            style={{ filter: 'drop-shadow(0 0 8px rgba(201,168,76,0.4))' }} />
          {sidebarOpen && (
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold text-white leading-tight">Gavel &amp; Brief</p>
              <p className="text-[10px] text-gray-500 font-medium tracking-widest uppercase">Admin</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative ${
                  isActive
                    ? 'bg-brand-600/20 text-brand-400'
                    : 'text-gray-400 hover:text-gray-100 hover:bg-white/5'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-brand-500 rounded-full" />
                  )}
                  <Icon size={16} className="flex-shrink-0" />
                  {sidebarOpen && <span className="text-sm font-medium">{label}</span>}
                  {!sidebarOpen && (
                    <div className="absolute left-14 bg-surface-3 text-gray-100 text-xs px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 border border-white/10">
                      {label}
                    </div>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-white/[0.08]">
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all text-sm font-medium"
          >
            <LogOut size={16} className="flex-shrink-0" />
            {sidebarOpen && 'Logout'}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-surface-1/60 backdrop-blur-sm">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-400 hover:text-gray-100 transition-colors p-1 rounded-lg hover:bg-white/5"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-600/30 border border-brand-500/30 flex items-center justify-center">
              <span className="text-xs font-semibold text-brand-400">A</span>
            </div>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
