import clsx from 'clsx'

export function StatCard({ title, value, subtitle, icon: Icon, color = 'blue', trend }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
    teal: 'bg-teal-50 text-teal-600',
    cafe: 'bg-green-50 text-[#068A4B]',
    bookshop: 'bg-blue-50 text-[#1565C0]',
    foodhut: 'bg-orange-50 text-[#B65505]',
  }

  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={clsx('p-3 rounded-xl', colors[color] || colors.blue)}>
            <Icon size={22} />
          </div>
        )}
      </div>
      {trend !== undefined && (
        <div className={clsx('mt-3 text-xs font-medium', trend >= 0 ? 'text-green-600' : 'text-red-500')}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs yesterday
        </div>
      )}
    </div>
  )
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

export function Badge({ children, color = 'gray' }) {
  const colors = {
    gray: 'bg-gray-100 text-gray-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
    orange: 'bg-orange-100 text-orange-700',
    yellow: 'bg-yellow-100 text-yellow-700',
  }
  return (
    <span className={clsx('px-2.5 py-0.5 rounded-full text-xs font-semibold', colors[color] || colors.gray)}>
      {children}
    </span>
  )
}

export function RoleBadge({ role }) {
  const map = {
    SUPERADMIN: { color: 'purple', label: 'Super Admin' },
    ADMIN: { color: 'blue', label: 'Admin' },
    STAFF: { color: 'green', label: 'Staff' },
    CUSTOMER: { color: 'orange', label: 'Customer' },
  }
  const { color, label } = map[role?.toUpperCase()] || { color: 'gray', label: role }
  return <Badge color={color}>{label}</Badge>
}

export function LoadingSpinner({ size = 'md' }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' }
  return (
    <div className="flex justify-center items-center py-8">
      <div className={clsx('animate-spin rounded-full border-2 border-primary-700 border-t-transparent', sizes[size])} />
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="text-center py-12">
      {Icon && <Icon size={48} className="mx-auto text-gray-300 mb-4" />}
      <h3 className="text-gray-500 font-medium text-lg">{title}</h3>
      {description && <p className="text-gray-400 text-sm mt-1">{description}</p>}
    </div>
  )
}

export function formatRs(amount) {
  return `Rs ${Number(amount || 0).toLocaleString('en-LK', { maximumFractionDigits: 0 })}`
}

