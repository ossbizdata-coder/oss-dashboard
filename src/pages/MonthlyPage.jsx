import { useEffect, useState } from 'react'
import {
  TrendingUp, TrendingDown, DollarSign, CreditCard,
  Coffee, BookOpen, UtensilsCrossed, RefreshCw,
  ChevronLeft, ChevronRight, Calendar
} from 'lucide-react'
import { dailyCashApi, salaryApi, transactionApi } from '../services/api.js'
import { PageHeader, LoadingSpinner, formatRs } from '../components/ui.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { format, subMonths, addMonths, startOfMonth } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

const SHOP_META = {
  CAFE:     { label: 'Cafe',     icon: Coffee,          bg: 'bg-[#068A4B]' },
  BOOKSHOP: { label: 'Bookshop', icon: BookOpen,        bg: 'bg-[#1565C0]' },
  FOODHUT:  { label: 'Food Hut', icon: UtensilsCrossed, bg: 'bg-[#B65505]' },
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const toNum = (v) => Number(v || 0)
const shopProfit = (shop = {}) => (shop.profit != null ? toNum(shop.profit) : (toNum(shop.totalSales) - toNum(shop.totalExpenses)))
const overallProfit = (summary = {}) => {
  const overall = summary?.overall || {}
  if (overall.totalProfit != null) return toNum(overall.totalProfit)
  const shops = summary?.shops || []
  return shops.reduce((sum, s) => sum + shopProfit(s), 0)
}

const monthRange = (year, month) => {
  const mm = String(month).padStart(2, '0')
  const start = `${year}-${mm}-01`
  const last = new Date(year, month, 0).getDate()
  const end = `${year}-${mm}-${String(last).padStart(2, '0')}`
  return { start, end }
}

const isZeroMonthlySummary = (summary) => {
  const shops = summary?.shops || []
  if (!shops.length) return true
  const tracked = shops.filter(s => SHOP_META[s.shopCode])
  if (!tracked.length) return true
  return tracked.every(s =>
    toNum(s.totalSales) === 0 &&
    toNum(s.totalExpenses) === 0 &&
    toNum(s.profit ?? 0) === 0
  )
}

async function getMonthlySummaryWithFallback(year, month) {
  try {
    const primary = (await dailyCashApi.getMonthlySummary(year, month)).data
    if (!isZeroMonthlySummary(primary)) return primary
  } catch (_) {
    // fallback below
  }

  const { start, end } = monthRange(year, month)
  const depts = ['CAFE', 'BOOKSHOP', 'FOODHUT']
  const res = await Promise.allSettled(
    depts.map((d) => transactionApi.getDepartmentSummaryRange(d, start, end))
  )

  const shops = res.map((r, i) => {
    const code = depts[i]
    const body = r.status === 'fulfilled' ? (r.value.data || {}) : {}
    const totalSales = toNum(body.calculatedSales)
    const totalExpenses = toNum(body.totalExpenses)
    const totalCredits = toNum(body.totalCredits)
    const profit = body.profit != null ? toNum(body.profit) : (totalSales - totalExpenses)
    return {
      shopCode: code,
      shopName: SHOP_META[code].label,
      totalSales,
      totalExpenses,
      totalCredits,
      profit,
      profitMargin: toNum(body.profitMargin),
      profitPercentage: toNum(body.profitPercentage),
      daysRecorded: 0,
    }
  })

  return {
    year,
    month,
    shops,
    overall: {
      totalSales: shops.reduce((s, x) => s + toNum(x.totalSales), 0),
      totalExpenses: shops.reduce((s, x) => s + toNum(x.totalExpenses), 0),
      totalCredits: shops.reduce((s, x) => s + toNum(x.totalCredits), 0),
      totalProfit: shops.reduce((s, x) => s + toNum(x.profit), 0),
    },
  }
}

export default function MonthlyPage() {
  const { isSuperAdmin } = useAuth()
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()))
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [monthlySalary, setMonthlySalary] = useState(0)
  const [ytd, setYtd] = useState({ sales: 0, expenses: 0, salary: 0, gross: 0, net: 0 })

  const year  = selectedMonth.getFullYear()
  const month = selectedMonth.getMonth() + 1 // 1-based
  const isCurrentMonth = year === new Date().getFullYear() && month === new Date().getMonth() + 1

  const load = async () => {
    setLoading(true)
    try {
      const [monthSummaryRes, monthSalaryRes] = await Promise.allSettled([
        getMonthlySummaryWithFallback(year, month),
        salaryApi.getAdminMonthly(year, month),
      ])

      // Monthly summary
      let monthSummary = null
      if (monthSummaryRes.status === 'fulfilled') {
        monthSummary = monthSummaryRes.value
      }
      setData(monthSummary)

      // Monthly staff salary
      let monthSalaryTotal = 0
      if (monthSalaryRes.status === 'fulfilled') {
        const rows = monthSalaryRes.value.data || []
        monthSalaryTotal = rows.reduce((s, r) => s + (r.totalSalary || 0), 0)
      }
      setMonthlySalary(monthSalaryTotal)

      // YTD rollup (Jan -> selected month)
      let ytdSales = 0
      let ytdExpenses = 0
      let ytdProfit = 0
      let ytdSalary = 0

      for (let m = 1; m <= month; m++) {
        const [mSummaryRes, mSalaryRes] = await Promise.allSettled([
          getMonthlySummaryWithFallback(year, m),
          salaryApi.getAdminMonthly(year, m),
        ])

        if (mSummaryRes.status === 'fulfilled') {
          const summary = mSummaryRes.value || {}
          const overall = summary.overall || {}
          ytdSales += overall.totalSales || 0
          ytdExpenses += overall.totalExpenses || 0
          ytdProfit += overallProfit(summary)
        }

        if (mSalaryRes.status === 'fulfilled') {
          const rows = mSalaryRes.value.data || []
          ytdSalary += rows.reduce((s, r) => s + (r.totalSalary || 0), 0)
        }
      }

      const ytdGross = ytdProfit
      const ytdNet = ytdGross - ytdSalary
      setYtd({ sales: ytdSales, expenses: ytdExpenses, salary: ytdSalary, gross: ytdGross, net: ytdNet })
    } catch (e) {
      setData(null)
      setMonthlySalary(0)
      setYtd({ sales: 0, expenses: 0, salary: 0, gross: 0, net: 0 })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [year, month])

  if (!isSuperAdmin) {
    return (
      <div className="card text-center py-12">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Access Restricted</h2>
        <p className="text-gray-500">Only SUPERADMIN can view monthly salary details.</p>
      </div>
    )
  }

  // Helpers
  const shopData = (shopCode) =>
    data?.shops?.find(s => s.shopCode === shopCode) || {}

  const overall = data?.overall || {}
  const monthlyGrossProfit = overallProfit(data)
  const monthlyNetProfit = monthlyGrossProfit - monthlySalary

  const chartData = Object.keys(SHOP_META).map(code => {
    const s = shopData(code)
    return {
      name: SHOP_META[code].label,
      Sales:    Math.round(s.totalSales    || 0),
      Expenses: Math.round(s.totalExpenses || 0),
      Credits:  Math.round(s.totalCredits  || 0),
      Profit:   Math.round(shopProfit(s)),
    }
  })

  return (
    <div>
      <PageHeader
        title="Monthly Summary"
        action={
          <button onClick={load} className="btn-outline flex items-center gap-2 text-sm">
            <RefreshCw size={15} /> Refresh
          </button>
        }
      />

      {/* ── Month Switcher ── */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center bg-white border border-gray-200 rounded-2xl px-2 py-1.5 gap-1 shadow-sm">
          <button onClick={() => setSelectedMonth(d => startOfMonth(subMonths(d, 1)))}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-gray-700 px-3 min-w-[110px] text-center">
            {MONTHS[month - 1]} {year}
          </span>
          <button onClick={() => setSelectedMonth(d => startOfMonth(addMonths(d, 1)))}
            disabled={isCurrentMonth}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30">
            <ChevronRight size={16} />
          </button>
        </div>
        {!isCurrentMonth && (
          <button onClick={() => setSelectedMonth(startOfMonth(new Date()))}
            className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-full font-medium transition-colors">
            This Month
          </button>
        )}
        <span className="flex items-center gap-1 text-sm text-gray-500">
          <Calendar size={14} />
          {isCurrentMonth ? 'Current Month (partial)' : format(selectedMonth, 'MMMM yyyy')}
        </span>
      </div>

      {/* ── Compact YTD Strip (Business Summary aligned) ── */}
      {!loading && (
        <div className="card mb-6 border border-primary-100">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="px-2 py-0.5 rounded bg-primary-700 text-white text-xs font-bold">YTD</span>
            <span className="text-gray-600">Jan - {MONTHS[month - 1]} {year}</span>
            <span className="text-gray-400">•</span>
            <span className="font-semibold text-blue-700">Gross Profit: {formatRs(ytd.gross)}</span>
            <span className="text-gray-400">•</span>
            <span className="font-semibold text-orange-700">Staff Salary: {formatRs(ytd.salary)}</span>
            <span className="text-gray-400">•</span>
            <span className={`font-bold ${ytd.net >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              Net Profit: {formatRs(ytd.net)}
            </span>
          </div>
        </div>
      )}

      {loading ? <LoadingSpinner size="lg" /> : !data ? (
        <div className="card text-center text-gray-400 py-12">No data available for this month</div>
      ) : (
        <>
          {/* ── Overall KPIs ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="card bg-gradient-to-br from-green-50 to-white border border-green-100">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={16} className="text-green-600" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Revenue</span>
              </div>
              <p className="text-2xl font-bold text-green-700">{formatRs(overall.totalSales)}</p>
              <p className="text-xs text-gray-400 mt-1">All shops · {MONTHS[month-1]} {year}</p>
            </div>
            <div className="card bg-gradient-to-br from-red-50 to-white border border-red-100">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown size={16} className="text-red-500" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Expenses</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{formatRs(overall.totalExpenses)}</p>
              <p className="text-xs text-gray-400 mt-1">All shops · {MONTHS[month-1]} {year}</p>
            </div>
            <div className="card bg-gradient-to-br from-blue-50 to-white border border-blue-100">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign size={16} className="text-blue-600" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Gross Profit</span>
              </div>
              <p className="text-2xl font-bold text-blue-700">{formatRs(monthlyGrossProfit)}</p>
              <p className="text-xs text-gray-400 mt-1">Sales x shop profit ratio</p>
            </div>
            <div className="card bg-gradient-to-br from-amber-50 to-white border border-amber-100">
              <div className="flex items-center gap-2 mb-1">
                <CreditCard size={16} className="text-amber-600" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Net Profit</span>
              </div>
              <p className={`text-2xl font-bold ${monthlyNetProfit >= 0 ? 'text-amber-700' : 'text-red-600'}`}>
                {formatRs(monthlyNetProfit)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Gross - Staff Salary ({formatRs(monthlySalary)})</p>
            </div>
          </div>

          {/* ── Per-Shop Breakdown ── */}
          <h2 className="text-base font-semibold text-gray-700 mb-3">Shop Breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {Object.entries(SHOP_META).map(([code, { label, icon: Icon, bg }]) => {
              const s = shopData(code)
              const est = shopProfit(s)
              return (
                <div key={code} className="card">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>
                      <Icon size={20} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">{label}</h3>
                      <p className="text-xs text-gray-400">{s.daysRecorded ?? 0} days recorded</p>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Revenue</span>
                      <span className="font-bold text-green-700">{formatRs(s.totalSales)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Expenses</span>
                      <span className="font-bold text-red-500">{formatRs(s.totalExpenses)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Credits</span>
                      <span className="font-bold text-amber-600">{formatRs(s.totalCredits)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-gray-500">Gross Profit</span>
                      <span className="font-bold text-blue-700">{formatRs(est)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Chart ── */}
          <div className="card">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Monthly Comparison — {MONTHS[month-1]} {year}
            </h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} width={65} tickFormatter={v => `Rs ${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatRs(v)} />
                <Legend />
                <Bar dataKey="Sales"    fill="#1565C0" radius={[4,4,0,0]} />
                <Bar dataKey="Expenses" fill="#ef4444" radius={[4,4,0,0]} />
                <Bar dataKey="Credits"  fill="#f59e0b" radius={[4,4,0,0]} />
                <Bar dataKey="Profit"   fill="#22c55e" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── Note ── */}
          <p className="text-xs text-gray-400 mt-4 text-center">
            ⚠️ Only <strong>closed days</strong> are included in monthly totals.
            Open/incomplete days appear when the day is closed in the app.
            Gross profit uses shop ratios (Cafe 12%, Bookshop 15%, Food Hut 20%). Net profit = Gross profit - Staff salary.
          </p>
        </>
      )}
    </div>
  )
}

