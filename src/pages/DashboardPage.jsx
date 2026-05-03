import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, DollarSign, CreditCard,
  Users, Coffee, BookOpen, UtensilsCrossed, RefreshCw,
  ChevronLeft, ChevronRight
} from 'lucide-react'
import { transactionApi, attendanceApi, dailyCashApi } from '../services/api.js'
import { StatCard, PageHeader, LoadingSpinner, formatRs } from '../components/ui.jsx'
import { format, subDays, addDays } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

const SHOPS = ['CAFE', 'BOOKSHOP', 'FOODHUT']
const todayStr = () => format(new Date(), 'yyyy-MM-dd')

export default function DashboardPage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [shopSummaries, setShopSummaries] = useState({})
  const [attendance, setAttendance] = useState([])

  const dateStr = format(selectedDate, 'yyyy-MM-dd')
  const isToday = dateStr === todayStr()

  const load = async () => {
    setLoading(true)
    try {
      const [summaries, att] = await Promise.allSettled([
        Promise.all(SHOPS.map(s =>
          dailyCashApi.getSummary(s, dateStr).then(r => {
            const d = r.data
            // Map DailyCashSummaryDTO fields to the shape the rest of the page expects
            return {
              shop: s,
              openingBalance: d.openingCash,
              closingBalance: d.closingCash,
              totalExpenses: d.totalExpenses,
              totalCredits: d.totalCredits,
              manualSales: d.manualSales,
              calculatedSales: d.totalSales,   // backend already computes the correct formula
              profit: d.totalSales != null ? d.totalSales * ({ CAFE: 0.12, BOOKSHOP: 0.15, FOODHUT: 0.20 }[s] || 0.10) : 0,
            }
          }).catch(() => ({ shop: s }))
        )),
        attendanceApi.getAll(),
      ])
      if (summaries.status === 'fulfilled') {
        const map = {}
        summaries.value.forEach(s => { map[s.shop] = s })
        setShopSummaries(map)
      }
      if (att.status === 'fulfilled') setAttendance(att.value?.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [dateStr])

  // OSD formula: Sales = (Closing - Opening) + Expenses + Credits (never negative)
  const calcSales = (s) => {
    if (!s) return 0
    let sales = s.calculatedSales ?? s.totalSales
    if (sales == null || sales < 0) {
      sales = (s.closingBalance - s.openingBalance) + (s.totalExpenses || 0) + (s.totalCredits || 0)
    }
    return sales >= 0 ? sales : 0
  }
  const totalSales    = SHOPS.reduce((sum, s) => sum + calcSales(shopSummaries[s]), 0)
  const totalExpenses = SHOPS.reduce((sum, s) => sum + (shopSummaries[s]?.totalExpenses || 0), 0)
  const totalProfit   = SHOPS.reduce((sum, s) => sum + (shopSummaries[s]?.profit || 0), 0)
  // Day's credits across all shops (from daily-cash summary)
  const totalDailyCredits = SHOPS.reduce((sum, s) => sum + (shopSummaries[s]?.totalCredits || 0), 0)
  // Staff Today: only ADMIN / SUPERADMIN roles, filtered to selected date, deduplicated by userId
  const adminStaffRaw = attendance.filter(a =>
    (a.userRole === 'ADMIN' || a.userRole === 'SUPERADMIN') &&
    a.workDate === dateStr
  )
  // Deduplicate: keep only the latest record per userId
  const seenUsers = new Set()
  const adminStaff = adminStaffRaw.filter(a => {
    const key = a.userId ?? a.userEmail ?? a.userName
    if (seenUsers.has(key)) return false
    seenUsers.add(key)
    return true
  })
  const workingToday = adminStaff.filter(a => a.status === 'WORKING' || a.isWorking === true).length

  const chartData = SHOPS.map(s => ({
    name: s === 'BOOKSHOP' ? 'Bookshop' : s.charAt(0) + s.slice(1).toLowerCase(),
    Sales:    Math.round(calcSales(shopSummaries[s])),
    Expenses: Math.round(shopSummaries[s]?.totalExpenses   || 0),
    Profit:   Math.round(shopSummaries[s]?.profit          || 0),
  }))

  return (
    <div>
      <PageHeader
        title="Business Dashboard"
        action={
          <button onClick={load} className="btn-outline flex items-center gap-2 text-sm">
            <RefreshCw size={15} /> Refresh
          </button>
        }
      />

      {/* ── Date Switcher ── */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center bg-white border border-gray-200 rounded-2xl px-2 py-1.5 gap-1 shadow-sm">
          <button onClick={() => setSelectedDate(d => subDays(d, 1))}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft size={16} />
          </button>
          <input
            type="date"
            value={dateStr}
            max={todayStr()}
            onChange={e => e.target.value && setSelectedDate(new Date(e.target.value + 'T00:00:00'))}
            className="text-sm font-semibold text-gray-700 outline-none bg-transparent cursor-pointer px-1"
          />
          <button onClick={() => setSelectedDate(d => addDays(d, 1))} disabled={isToday}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30">
            <ChevronRight size={16} />
          </button>
        </div>
        {!isToday && (
          <button onClick={() => setSelectedDate(new Date())}
            className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-full font-medium transition-colors">
            Today
          </button>
        )}
        <span className="text-sm text-gray-500">
          {isToday ? '📅 Today' : format(selectedDate, 'EEE, MMM d, yyyy')}
        </span>
      </div>

      {loading ? <LoadingSpinner size="lg" /> : (
        <>
          {/* ── Daily Balance per Shop ── */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { code: 'CAFE',     label: 'Cafe',     icon: Coffee,          border: 'border-[#068A4B]', text: 'text-[#068A4B]' },
              { code: 'BOOKSHOP', label: 'Bookshop', icon: BookOpen,        border: 'border-[#1565C0]', text: 'text-[#1565C0]' },
              { code: 'FOODHUT',  label: 'Food Hut', icon: UtensilsCrossed, border: 'border-[#B65505]', text: 'text-[#B65505]' },
            ].map(({ code, label, icon: Icon, border, text }) => {
              const s = shopSummaries[code] || {}
              const hasClosed = s.closingBalance != null && s.closingBalance > 0
              const displayBalance = hasClosed ? s.closingBalance : (s.openingBalance ?? 0)
              return (
                <div key={code} className={`card py-3 border-l-4 ${border}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon size={13} className={text} />
                    <p className={`text-xs font-semibold uppercase tracking-wide ${text}`}>{label}</p>
                  </div>
                  <p className="text-xl font-bold text-gray-800">{formatRs(displayBalance)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {hasClosed ? `Open: ${formatRs(s.openingBalance ?? 0)}` : '⏳ Opening (no closing yet)'}
                  </p>
                </div>
              )
            })}
          </div>

          {/* ── KPI Row ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard title="Revenue"        value={formatRs(totalSales)}         icon={TrendingUp}  color="green"  subtitle="All shops combined" />
            <StatCard title="Expenses"       value={formatRs(totalExpenses)}      icon={TrendingDown} color="red"   subtitle="All shops combined" />
            <StatCard title="Est. Profit"    value={formatRs(totalProfit)}        icon={DollarSign}  color="blue"   subtitle="~12-20% margin on sales" />
            <StatCard title="Day Credits"    value={formatRs(totalDailyCredits)}  icon={CreditCard}  color="orange" subtitle="Credits given this day" />
          </div>

          {/* ── Shop Summaries ── */}
          <h2 className="text-base font-semibold text-gray-700 mb-3">
            Shop Summaries
            <span className="ml-2 text-xs font-normal text-gray-400">
              {isToday ? 'Today' : format(selectedDate, 'MMM d')}
            </span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[
              { code: 'CAFE',     label: 'Cafe',     icon: Coffee,          bg: 'bg-[#068A4B]' },
              { code: 'BOOKSHOP', label: 'Bookshop', icon: BookOpen,        bg: 'bg-[#1565C0]' },
              { code: 'FOODHUT',  label: 'Food Hut', icon: UtensilsCrossed, bg: 'bg-[#B65505]' },
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
                    <div><p className="text-gray-500">Sales</p><p className="font-bold text-green-700">{formatRs(calcSales(s))}</p></div>
                    <div><p className="text-gray-500">Expenses</p><p className="font-bold text-red-600">{formatRs(s.totalExpenses)}</p></div>
                    <div><p className="text-gray-500">Opening</p><p className="font-semibold">{formatRs(s.openingBalance)}</p></div>
                    <div><p className="text-gray-500">Closing</p><p className="font-semibold">{formatRs(s.closingBalance)}</p></div>
                    {s.openingBalance != null && (
                      <div className="col-span-2 border-t pt-2 mt-1">
                        <p className="text-gray-500">Credits <span className="text-xs">(this day)</span></p>
                        <p className="font-bold text-amber-600">{formatRs(s.totalCredits || 0)}</p>
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>

          {/* ── Chart + Staff (bottom) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="card lg:col-span-2">
              <h2 className="text-base font-semibold text-gray-800 mb-4">
                Shop Performance
                <span className="ml-2 text-xs font-normal text-gray-400">
                  {isToday ? 'Today' : format(selectedDate, 'MMM d')}
                </span>
              </h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} width={60} tickFormatter={v => `Rs ${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => formatRs(v)} />
                  <Legend />
                  <Bar dataKey="Sales"    fill="#1565C0" radius={[4,4,0,0]} />
                  <Bar dataKey="Expenses" fill="#ef4444" radius={[4,4,0,0]} />
                  <Bar dataKey="Profit"   fill="#22c55e" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h2 className="text-base font-semibold text-gray-800 mb-4">
                <Users size={16} className="inline mr-2" />Staff Today
                <span className="ml-1 text-xs font-normal text-gray-400">(Admin)</span>
              </h2>
              <div className="text-4xl font-bold text-primary-700 mb-1">{workingToday}</div>
              <div className="text-sm text-gray-500 mb-4">admins working {isToday ? 'today' : format(selectedDate, 'MMM d')}</div>
              <div className="space-y-2">
                {adminStaff.length === 0 ? (
                  <p className="text-sm text-gray-400">No attendance records for this date</p>
                ) : adminStaff.slice(0, 8).map((a, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 font-medium">{a.userName || a.name || 'Staff'}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      (a.status === 'WORKING' || a.isWorking) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                    }`}>
                      {(a.status === 'WORKING' || a.isWorking) ? '✓ In' : '✗ Off'}
                    </span>
                  </div>
                ))
                }
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

