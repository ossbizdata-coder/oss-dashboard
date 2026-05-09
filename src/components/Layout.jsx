import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import {
  LayoutDashboard, Store, Users, CreditCard, UtensilsCrossed,
  BarChart3, Shield, Settings, LogOut, ChevronRight, Menu, X, CalendarDays, UserCog, Receipt
} from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/shops', label: 'Shops', icon: Store },
  { to: '/monthly', label: 'Monthly Summary', icon: CalendarDays },
  { to: '/staff', label: 'Staff & HR', icon: Users },
  { to: '/credits',  label: 'Credits',    icon: CreditCard },
  { to: '/expenses', label: 'Expenses',   icon: Receipt },
  { to: '/foodhut',  label: 'Food Hut',   icon: UtensilsCrossed },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/audit-logs', label: 'Audit Logs', icon: Shield, superAdminOnly: true },
  { to: '/users',      label: 'User Management', icon: UserCog, superAdminOnly: true },
  { to: '/settings',   label: 'Settings', icon: Settings, superAdminOnly: true },
]

export default function Layout() {
  const { user, logout, isSuperAdmin } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const visibleNav = navItems.filter(item => !item.superAdminOnly || isSuperAdmin)

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        'fixed lg:static inset-y-0 left-0 z-30 w-64 bg-gradient-to-b from-primary-900 to-primary-800 flex flex-col transition-transform duration-300',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Store size={22} className="text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">OneStopSolutions</p>
              <p className="text-white/60 text-xs">Owner Dashboard</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {visibleNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                clsx('sidebar-link', isActive && 'active')
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center text-white font-bold text-sm">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{user?.name}</p>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-white/80">
                {user?.role}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-white/70 hover:text-white text-sm w-full px-2 py-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
          <button
            className="lg:hidden text-gray-500 hover:text-gray-700"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={22} />
          </button>
          <div className="flex-1" />
          <span className="text-sm text-gray-500">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

