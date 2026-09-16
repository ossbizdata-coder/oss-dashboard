import { useEffect, useState } from 'react'
import {
  TrendingUp, TrendingDown, DollarSign, CreditCard,
  Coffee, BookOpen, UtensilsCrossed, RefreshCw,
  ChevronLeft, ChevronRight
} from 'lucide-react'
import { dailyCashApi, salaryApi } from '../services/api.js'
import { PageHeader, LoadingSpinner, formatRs } from '../components/ui.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { subMonths, addMonths, startOfMonth } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import useBusinessSettings from '../hooks/useBusinessSettings.js'
import { calculateConfiguredProfit, getTotalFixedMonthlyExpenses, toNumber } from '../utils/businessSettings.js'

const SHOP_META = {
  CAFE: { label: 'Cafe', icon: Coffee, bg: 'bg-[#068A4B]' },
  BOOKSHOP: { label: 'Bookshop', icon: BookOpen, bg: 'bg-[#1565C0]' },
  FOODHUT: { label: 'Food Hut', icon: UtensilsCrossed, bg: 'bg-[#B65505]' },
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const getTrackedShops = (summary = {}) => (summary.shops || []).filter((shop) => SHOP_META[shop.shopCode])

const getMonthlyRevenue = (summary = {}) => getTrackedShops(summary).reduce((sum, shop) => sum + toNumber(shop.totalSales), 0)

export default function MonthlyPage() {
  const { isSuperAdmin } = useAuth()
  const [businessSettings] = useBusinessSettings()
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()))
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [monthlySalary, setMonthlySalary] = useState(0)
  const [monthlyWorkingDays, setMonthlyWorkingDays] = useState(0)
  const [ytd, setYtd] = useState({ sales: 0, expenses: 0, salary: 0, fixed: 0, gross: 0, net: 0 })

  const year = selectedMonth.getFullYear()
  const month = selectedMonth.getMonth() + 1
  const isCurrentMonth = year === new Date().getFullYear() && month === new Date().getMonth() + 1

  const getShopProfit = (shopCode, totalSales) => calculateConfiguredProfit(shopCode, totalSales, businessSettings)

  const getOverallProfit = (summary = {}) => getTrackedShops(summary).reduce(
    (sum, shop) => sum + getShopProfit(shop.shopCode, shop.totalSales),
    0
  )

  const load = async () => {
    setLoading(true)
    try {
      const [monthSummaryRes, monthSalaryRes] = await Promise.allSettled([
        dailyCashApi.getMonthlySummary(year, month),
        salaryApi.getAdminMonthly(year, month),
      ])

      const monthSummary = monthSummaryRes.status === 'fulfilled' ? (monthSummaryRes.value.data || null) : null
      setData(monthSummary)

      let monthSalaryTotal = 0
      let monthWorkingDays = 0
      if (monthSalaryRes.status === 'fulfilled') {
        const rows = monthSalaryRes.value.data || []
        monthSalaryTotal = rows.reduce((sum, row) => sum + toNumber(row.totalSalary), 0)
        monthWorkingDays = rows.reduce((sum, row) => sum + toNumber(
          row.workDays ?? row.daysWorked ?? row.workingDays ?? row.totalWorkDays ?? row.days
        ), 0)
      }
      setMonthlySalary(monthSalaryTotal)
      setMonthlyWorkingDays(monthWorkingDays)

      let ytdSales = 0
      let ytdExpenses = 0
      let ytdGross = 0
      let ytdSalary = 0

      for (let currentMonth = 1; currentMonth <= month; currentMonth += 1) {
        const [summaryRes, salaryRes] = await Promise.allSettled([
          dailyCashApi.getMonthlySummary(year, currentMonth),
          salaryApi.getAdminMonthly(year, currentMonth),
        ])

        if (summaryRes.status === 'fulfilled') {
          const summary = summaryRes.value.data || {}
          ytdSales += getMonthlyRevenue(summary)
          ytdExpenses += toNumber(summary?.overall?.totalExpenses)
          ytdGross += getOverallProfit(summary)
        }

        if (salaryRes.status === 'fulfilled') {
          const rows = salaryRes.value.data || []
          ytdSalary += rows.reduce((sum, row) => sum + toNumber(row.totalSalary), 0)
        }
      }

      const monthlyFixedExpenses = getTotalFixedMonthlyExpenses(businessSettings)
      const ytdFixedExpenses = monthlyFixedExpenses * month
      setYtd({
        sales: ytdSales,
        expenses: ytdExpenses,
        salary: ytdSalary,
        fixed: ytdFixedExpenses,
        gross: ytdGross,
        net: ytdGross - ytdSalary - ytdFixedExpenses,
      })
    } catch (_) {
      setData(null)
      setMonthlySalary(0)
      setMonthlyWorkingDays(0)
      setYtd({ sales: 0, expenses: 0, salary: 0, fixed: 0, gross: 0, net: 0 })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [year, month, businessSettings])

  if (!isSuperAdmin) {
    return (
      <div className="card text-center py-12">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Access Restricted</h2>
        <p className="text-gray-500">Only SUPERADMIN can view monthly salary details.</p>
      </div>
    )
  }

  const shopData = (shopCode) => data?.shops?.find((shop) => shop.shopCode === shopCode) || {}
  const overall = data?.overall || {}
  const monthlyRevenue = getMonthlyRevenue(data || {})
  const monthlyGrossProfit = getOverallProfit(data || {})
  const monthlyFixedExpenses = getTotalFixedMonthlyExpenses(businessSettings)
  const monthlyNetProfit = monthlyGrossProfit - monthlySalary - monthlyFixedExpenses

  const chartData = Object.keys(SHOP_META).map((shopCode) => {
    const shop = shopData(shopCode)
    return {
      name: SHOP_META[shopCode].label,
      Sales: Math.round(toNumber(shop.totalSales)),
      Expenses: Math.round(toNumber(shop.totalExpenses)),
      Credits: Math.round(toNumber(shop.totalCredits)),
      Profit: Math.round(getShopProfit(shopCode, shop.totalSales)),
    }
  })

  return (
    <div>
      <PageHeader
        title="Monthly Summary"
        action={(
          <>
            <div className="flex items-center bg-white border border-gray-200 rounded-2xl px-2 py-1.5 gap-1 shadow-sm">
              <button onClick={() => setSelectedMonth((date) => startOfMonth(subMonths(date, 1)))}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold text-gray-700 px-3 min-w-[110px] text-center">
                {MONTHS[month - 1]} {year}
              </span>
              <button onClick={() => setSelectedMonth((date) => startOfMonth(addMonths(date, 1)))}
                disabled={isCurrentMonth}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30">
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="rounded-2xl bg-primary-50 border border-primary-100 px-3 py-2 flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-primary-700 whitespace-nowrap">Working Days :</span>
              <span className="text-sm font-semibold text-primary-900">{monthlyWorkingDays}</span>
            </div>
            {!isCurrentMonth && (
              <button onClick={() => setSelectedMonth(startOfMonth(new Date()))}
                className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-full font-medium transition-colors">
                This Month
              </button>
            )}
            <button onClick={load} className="btn-outline flex items-center gap-2 text-sm">
              <RefreshCw size={15} /> Refresh
            </button>
          </>
        )}
      />

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
            <span className="font-semibold text-purple-700">Fixed Expenses: {formatRs(ytd.fixed)}</span>
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="card bg-gradient-to-br from-green-50 to-white border border-green-100">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={16} className="text-green-600" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Sales</span>
              </div>
              <p className="text-2xl font-bold text-green-700">{formatRs(monthlyRevenue)}</p>
              <p className="text-xs text-gray-400 mt-1">All shops · {MONTHS[month - 1]} {year}</p>
            </div>
            <div className="card bg-gradient-to-br from-red-50 to-white border border-red-100">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown size={16} className="text-red-500" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Expenses</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{formatRs(overall.totalExpenses)}</p>
              <p className="text-xs text-gray-400 mt-1">All shops · {MONTHS[month - 1]} {year}</p>
            </div>
            <div className="card bg-gradient-to-br from-blue-50 to-white border border-blue-100">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign size={16} className="text-blue-600" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Gross Profit</span>
              </div>
              <p className="text-2xl font-bold text-blue-700">{formatRs(monthlyGrossProfit)}</p>
              <p className="text-xs text-gray-400 mt-1">Using configured shop profit rates</p>
            </div>
            <div className="card bg-gradient-to-br from-amber-50 to-white border border-amber-100">
              <div className="flex items-center gap-2 mb-1">
                <CreditCard size={16} className="text-amber-600" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Net Profit</span>
              </div>
              <p className={`text-2xl font-bold ${monthlyNetProfit >= 0 ? 'text-amber-700' : 'text-red-600'}`}>
                {formatRs(monthlyNetProfit)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Gross - Staff Salary - Fixed Expenses</p>
            </div>
          </div>

          <h2 className="text-base font-semibold text-gray-700 mb-3">Department Breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {Object.entries(SHOP_META).map(([shopCode, { label, icon: Icon, bg }]) => {
              const shop = shopData(shopCode)
              const shopProfit = getShopProfit(shopCode, shop.totalSales)
              return (
                <div key={shopCode} className="card">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>
                      <Icon size={20} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">{label}</h3>
                      <p className="text-xs text-gray-400">{shop.daysRecorded ?? 0} days recorded</p>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Sales</span>
                      <span className="font-bold text-green-700">{formatRs(shop.totalSales)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Expenses</span>
                      <span className="font-bold text-red-500">{formatRs(shop.totalExpenses)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Credits</span>
                      <span className="font-bold text-amber-600">{formatRs(shop.totalCredits)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-gray-500">Gross Profit</span>
                      <span className="font-bold text-blue-700">{formatRs(shopProfit)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="card">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Monthly Comparison — {MONTHS[month - 1]} {year}
            </h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} width={65} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => formatRs(value)} />
                <Legend />
                <Bar dataKey="Sales" fill="#1565C0" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Credits" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Profit" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <p className="text-xs text-gray-400 mt-4 text-center">
            Only closed days are included. Gross profit uses Settings profit rates, and net profit subtracts staff salary plus fixed monthly expenses.
          </p>
        </>
      )}
    </div>
  )
}
