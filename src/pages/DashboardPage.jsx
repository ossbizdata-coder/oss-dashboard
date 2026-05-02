import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, DollarSign, CreditCard,
  Users, Coffee, BookOpen, UtensilsCrossed, RefreshCw
} from 'lucide-react'
import { transactionApi, creditApi, attendanceApi } from '../services/api.js'
import { StatCard, PageHeader, LoadingSpinner, formatRs } from '../components/ui.jsx'
import { format } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

const SHOPS = ['CAFE', 'BOOKSHOP', 'FOODHUT']

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [shopSummaries, setShopSummaries] = useState({})
  const [unpaidCredits, setUnpaidCredits] = useState(0)
  const [attendance, setAttendance] = useState([])
  const today = format(new Date(), 'yyyy-MM-dd')

  const load = async () => {
    setLoading(true)
    try {
      const [summaries, credits, att] = await Promise.allSettled([
        Promise.all(SHOPS.map(s => transactionApi.getDepartmentSummary(s, today).then(r => ({ shop: s, ...r.data })))),
        creditApi.getUnpaidTotal(),
        attendanceApi.getAll(),
      ])

      if (summaries.status === 'fulfilled') {
        const map = {}
        summaries.value.forEach(s => { map[s.shop] = s })
        setShopSummaries(map)
      }
      if (credits.status === 'fulfilled') {
        setUnpaidCredits(credits.value?.data?.total || 0)
      }
      if (att.status === 'fulfilled') {
        setAttendance(att.value?.data || [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const totalSales = SHOPS.reduce((sum, s) => sum + (shopSummaries[s]?.calculatedSales || 0), 0)
  const totalExpenses = SHOPS.reduce((sum, s) => sum + (shopSummaries[s]?.totalExpenses || 0), 0)
  const totalProfit = SHOPS.reduce((sum, s) => sum + (shopSummaries[s]?.profit || 0), 0)
  const workingToday = attendance.filter(a => a.status === 'WORKING').length

  const chartData = SHOPS.map(s => ({
    name: s === 'BOOKSHOP' ? 'Bookshop' : s.charAt(0) + s.slice(1).toLowerCase(),
    Sales: Math.round(shopSummaries[s]?.calculatedSales || 0),
    Expenses: Math.round(shopSummaries[s]?.totalExpenses || 0),
    Profit: Math.round(shopSummaries[s]?.profit || 0),
  }))

  if (loading) return <LoadingSpinner size="lg" />

  return (
    <div>
      <PageHeader
        title="Business Dashboard"
        subtitle={`Today — ${format(new Date(), 'EEEE, MMMM d, yyyy')}`}
        action={
          <button onClick={load} className="btn-outline flex items-center gap-2 text-sm">
            <RefreshCw size={15} /> Refresh
          </button>
        }
      />

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Today's Revenue" value={formatRs(totalSales)} icon={TrendingUp} color="green" subtitle="All shops combined" />
        <StatCard title="Today's Expenses" value={formatRs(totalExpenses)} icon={TrendingDown} color="red" subtitle="All shops combined" />
        <StatCard title="Net Profit" value={formatRs(totalProfit)} icon={DollarSign} color="blue" subtitle="Estimated" />
        <StatCard title="Unpaid Credits" value={formatRs(unpaidCredits)} icon={CreditCard} color="orange" subtitle="Total outstanding" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Chart */}
        <div className="card lg:col-span-2">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Today's Shop Performance</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} width={60} tickFormatter={v => `Rs ${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatRs(v)} />
              <Legend />
              <Bar dataKey="Sales" fill="#1565C0" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Profit" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Staff & Attendance */}
        <div className="card">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            <Users size={16} className="inline mr-2" />Staff Today
          </h2>
          <div className="text-4xl font-bold text-primary-700 mb-1">{workingToday}</div>
          <div className="text-sm text-gray-500 mb-4">staff working today</div>
          <div className="space-y-2">
            {attendance.slice(0, 6).map((a, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 font-medium">{a.userName || a.name || 'Staff'}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  a.status === 'WORKING' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}>
                  {a.status === 'WORKING' ? '✓ In' : '✗ Off'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Shop Cards */}
      <h2 className="text-base font-semibold text-gray-800 mb-4">Shop Summaries</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { code: 'CAFE', label: 'Cafe', icon: Coffee, color: 'cafe', bg: 'bg-[#068A4B]' },
          { code: 'BOOKSHOP', label: 'Bookshop', icon: BookOpen, color: 'bookshop', bg: 'bg-[#1565C0]' },
          { code: 'FOODHUT', label: 'Food Hut', icon: UtensilsCrossed, color: 'foodhut', bg: 'bg-[#B65505]' },
        ].map(({ code, label, icon: Icon, bg }) => {
          const s = shopSummaries[code] || {}
          return (
            <Link key={code} to={`/shops/${code}`} className="card hover:shadow-md transition-shadow group">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>
                  <Icon size={20} className="text-white" />
                </div>
                <h3 className="font-semibold text-gray-800">{label}</h3>
                <span className="ml-auto text-xs text-gray-400 group-hover:text-primary-600 transition-colors">View →</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Sales</p>
                  <p className="font-bold text-green-700">{formatRs(s.calculatedSales)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Expenses</p>
                  <p className="font-bold text-red-600">{formatRs(s.totalExpenses)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Opening</p>
                  <p className="font-semibold">{formatRs(s.openingBalance)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Closing</p>
                  <p className="font-semibold">{formatRs(s.closingBalance)}</p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

