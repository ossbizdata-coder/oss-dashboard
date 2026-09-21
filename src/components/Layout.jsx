import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import {
  LayoutDashboard, Store, Users, CreditCard,
  BarChart3, Shield, Settings, LogOut, Menu, CalendarDays, Receipt,
  AlertTriangle
} from 'lucide-react'
import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { creditApi } from '../services/api.js'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/shops', label: 'Departments', icon: Store },
  { to: '/monthly', label: 'Monthly Summary', icon: CalendarDays, superAdminOnly: true },
  { to: '/staff', label: 'Staff & HR', icon: Users },
  { to: '/credits',  label: 'Credits',    icon: CreditCard },
  { to: '/expenses', label: 'Expenses',   icon: Receipt },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/audit-logs', label: 'Audit Logs', icon: Shield, superAdminOnly: true },
  { to: '/settings',   label: 'Settings', icon: Settings, superAdminOnly: true },
]

export default function Layout() {
  const { user, logout, isSuperAdmin } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [urgentCredits, setUrgentCredits] = useState([])

  useEffect(() => {
    let active = true

    const loadUrgentAlerts = async () => {
      try {
        const response = await creditApi.getAll()
        if (!active) return

        const credits = Array.isArray(response?.data) ? response.data : []
        const now = Date.now()
        const overdue = credits.filter((credit) => {
          if (credit?.isPaid) return false
          if (!credit?.createdAt) return false

          const createdAt = new Date(credit.createdAt).getTime()
          if (Number.isNaN(createdAt)) return false

          return (now - createdAt) >= 30 * 24 * 60 * 60 * 1000
        })

        setUrgentCredits(overdue)
      } catch (error) {
        if (active) setUrgentCredits([])
      }
    }

    loadUrgentAlerts()
    return () => {
      active = false
    }
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const visibleNav = navItems.filter(item => !item.superAdminOnly || isSuperAdmin)
  const urgentDepartmentSummary = urgentCredits.reduce((summary, credit) => {
    const department = (credit.department || 'COMMON').toUpperCase()
    summary[department] = (summary[department] || 0) + 1
    return summary
  }, {})

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

        {urgentCredits.length > 0 && (
          <div className="border-b border-red-200 bg-red-50 px-6 py-3">
            <div className="mx-auto flex max-w-6xl items-center gap-3 text-red-800">
              <AlertTriangle size={18} className="shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  <span>Urgent action required</span>
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                    {urgentCredits.length} overdue credit{urgentCredits.length > 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-xs text-red-700 mt-0.5">
                  {Object.entries(urgentDepartmentSummary)
                    .map(([department, count]) => `${department}: ${count}`)
                    .join(' • ')}
                  {' '}older than 30 days. Please follow up immediately.
                </p>
              </div>
              <NavLink
                to="/credits"
                className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors"
              >
                View credits
              </NavLink>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
