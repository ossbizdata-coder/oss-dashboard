import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, DollarSign, CreditCard,
  Users, Coffee, BookOpen, UtensilsCrossed, RefreshCw,
  ChevronLeft, ChevronRight
} from 'lucide-react'
import { attendanceApi, dailyCashApi } from '../services/api.js'
import { LoadingSpinner, formatRs } from '../components/ui.jsx'
import { format, subDays, addDays } from 'date-fns'
import { calculateCalculatedSales, calculateReloadAdjustedProfit, getReloadExpenseAmount } from '../utils/businessSettings.js'

const SHOPS = ['CAFE', 'BOOKSHOP', 'FOODHUT']
const SHOP_CARDS = [
  { code: 'CAFE', label: 'Cafe', icon: Coffee, border: 'border-[#068A4B]', text: 'text-[#068A4B]', bg: 'bg-[#068A4B]' },
  { code: 'BOOKSHOP', label: 'Bookshop', icon: BookOpen, border: 'border-[#1565C0]', text: 'text-[#1565C0]', bg: 'bg-[#1565C0]' },
  { code: 'FOODHUT', label: 'Food Hut', icon: UtensilsCrossed, border: 'border-[#B65505]', text: 'text-[#B65505]', bg: 'bg-[#B65505]' },
]

const todayStr = () => format(new Date(), 'yyyy-MM-dd')

export default function DashboardPage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [shopSummaries, setShopSummaries] = useState({})
  const [attendance, setAttendance] = useState([])
  const [loadWarning, setLoadWarning] = useState('')

  const dateStr = format(selectedDate, 'yyyy-MM-dd')
  const isToday = dateStr === todayStr()

  const load = async () => {
    setLoading(true)
    setLoadWarning('')
    try {
      const loadOneShop = async (shopCode) => {
        const response = await dailyCashApi.getSummary(shopCode, dateStr)
        const data = response.data || {}
        return {
          shop: shopCode,
          openingBalance: data.openingCash,
          closingBalance: data.closingCash,
          totalExpenses: data.totalExpenses || 0,
          totalCredits: data.totalCredits || 0,
          manualSales: data.manualSales || 0,
          calculatedSales: data.totalSales || 0,
          reloadExpense: getReloadExpenseAmount(data.expenses || []),
        }
      }

      const [summaries, attendanceResult] = await Promise.allSettled([
        Promise.all(SHOPS.map((shopCode) => loadOneShop(shopCode).catch(() => ({ shop: shopCode, _failed: true })))),
        attendanceApi.getAll(),
      ])

      if (summaries.status === 'fulfilled') {
        const map = {}
        summaries.value.forEach((summary) => { map[summary.shop] = summary })
        setShopSummaries(map)
        const failed = summaries.value.filter((summary) => summary._failed).length
        if (failed > 0) setLoadWarning(`Some shop totals could not be loaded for ${dateStr}.`)
      }

      if (attendanceResult.status === 'fulfilled') {
        setAttendance(attendanceResult.value?.data || [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [dateStr])

  const calcSales = (summary) => calculateCalculatedSales(summary)
  const calcProfit = (shopCode) => calculateReloadAdjustedProfit(
    calcSales(shopSummaries[shopCode]),
    shopSummaries[shopCode]?.reloadExpense
  )

  const totalSales = SHOPS.reduce((sum, shopCode) => sum + calcSales(shopSummaries[shopCode]), 0)
  const totalExpenses = SHOPS.reduce((sum, shopCode) => sum + (shopSummaries[shopCode]?.totalExpenses || 0), 0)
  const totalProfit = SHOPS.reduce((sum, shopCode) => sum + calcProfit(shopCode), 0)
  const totalDailyCredits = SHOPS.reduce((sum, shopCode) => sum + (shopSummaries[shopCode]?.totalCredits || 0), 0)
  const totalReloadExpense = SHOPS.reduce((sum, shopCode) => sum + (shopSummaries[shopCode]?.reloadExpense || 0), 0)
  const reloadSalesProxy = totalReloadExpense * 1.05
  const reloadAdjustment = Math.round(reloadSalesProxy * 0.07)

  const adminStaffRaw = attendance.filter((item) =>
    (item.userRole === 'ADMIN' || item.userRole === 'SUPERADMIN') &&
    item.workDate === dateStr
  )

  const seenUsers = new Set()
  const adminStaff = adminStaffRaw.filter((item) => {
    const key = item.userId ?? item.userEmail ?? item.userName
    if (seenUsers.has(key)) return false
    seenUsers.add(key)
    return true
  })

  const workingToday = adminStaff.filter((item) => item.status === 'WORKING' || item.isWorking === true).length

  return (
    <div>
      <div className="flex flex-col gap-3 mb-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Business Dashboard</h1>
          <div className="flex items-center bg-white border border-gray-200 rounded-2xl px-2 py-1.5 gap-1 shadow-sm">
            <button onClick={() => setSelectedDate((date) => subDays(date, 1))}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronLeft size={16} />
            </button>
            <input
              type="date"
              value={dateStr}
              max={todayStr()}
              onChange={(event) => event.target.value && setSelectedDate(new Date(event.target.value + 'T00:00:00'))}
              className="text-sm font-semibold text-gray-700 outline-none bg-transparent cursor-pointer px-1"
            />
            <button onClick={() => setSelectedDate((date) => addDays(date, 1))} disabled={isToday}
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
        </div>
        <button onClick={load} className="btn-outline flex items-center gap-2 text-sm self-start xl:self-auto">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {loadWarning && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {loadWarning}
        </div>
      )}

      {loading ? <LoadingSpinner size="lg" /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="card border-l-4 border-emerald-500 bg-gradient-to-br from-emerald-50 via-white to-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[15px] font-semibold text-gray-700">Sales</p>
                  <p className="text-[23px] font-extrabold text-emerald-700 mt-2">{formatRs(totalSales)}</p>
                </div>
                <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700"><TrendingUp size={18} /></div>
              </div>
            </div>
            <div className="card border-l-4 border-red-500 bg-gradient-to-br from-red-50 via-white to-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[15px] font-semibold text-gray-700">Expenses</p>
                  <p className="text-[23px] font-extrabold text-red-700 mt-2">{formatRs(totalExpenses)}</p>
                </div>
                <div className="rounded-xl bg-red-100 p-2.5 text-red-700"><TrendingDown size={18} /></div>
              </div>
            </div>
            <div className="card border-l-4 border-blue-500 bg-gradient-to-br from-blue-50 via-white to-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[15px] font-semibold text-gray-700">Profit</p>
                  <p className="text-[23px] font-extrabold text-blue-700 mt-2">{formatRs(totalProfit)}</p>
                  {totalReloadExpense > 0 && (
                    <p className="text-[11px] text-blue-700/80 mt-1">
                      Reload adjusted (−{formatRs(reloadAdjustment)}) from {formatRs(totalReloadExpense)} reload expense
                    </p>
                  )}
                </div>
                <div className="rounded-xl bg-blue-100 p-2.5 text-blue-700"><DollarSign size={18} /></div>
              </div>
            </div>
            <div className="card border-l-4 border-amber-500 bg-gradient-to-br from-amber-50 via-white to-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[15px] font-semibold text-gray-700">Credits</p>
                  <p className="text-[23px] font-extrabold text-amber-700 mt-2">{formatRs(totalDailyCredits)}</p>
                </div>
                <div className="rounded-xl bg-amber-100 p-2.5 text-amber-700"><CreditCard size={18} /></div>
              </div>
            </div>
          </div>

          <h2 className="text-base font-semibold text-gray-700 mb-3">
            Department Summaries
            <span className="ml-2 text-xs font-normal text-gray-400">
              {isToday ? 'Today' : format(selectedDate, 'MMM d')}
            </span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {SHOP_CARDS.map(({ code, label, icon: Icon, border, text, bg }) => {
              const summary = shopSummaries[code] || {}
              const shopDateLink = `/shops/${code}?date=${encodeURIComponent(dateStr)}`

              return (
                <div key={code} className={`card hover:shadow-md transition-shadow border-l-4 ${border} group`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>
                      <Icon size={20} className="text-white" />
                    </div>
                    <h3 className={`font-semibold ${text}`}>{label}</h3>
                    <Link to={shopDateLink} className="ml-auto text-xs text-gray-400 group-hover:text-primary-600 transition-colors">
                      View →
                    </Link>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-gray-50 px-3 py-2">
                        <p className="text-gray-500 text-xs">Opening</p>
                        <p className="font-bold text-gray-800 mt-1">{formatRs(summary.openingBalance)}</p>
                      </div>
                      <div className="rounded-xl bg-gray-50 px-3 py-2">
                        <p className="text-gray-500 text-xs">Closing</p>
                        <p className="font-bold text-gray-800 mt-1">{formatRs(summary.closingBalance)}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl bg-green-50 px-3 py-2">
                        <p className="text-gray-500 text-xs">Sales</p>
                        <p className="font-bold text-green-700 mt-1">{formatRs(calcSales(summary))}</p>
                      </div>
                      <div className="rounded-xl bg-red-50 px-3 py-2">
                        <p className="text-gray-500 text-xs">Expenses</p>
                        <Link to={shopDateLink} className="font-bold text-red-600 mt-1 inline-block hover:underline">
                          {formatRs(summary.totalExpenses)}
                        </Link>
                      </div>
                      <div className="rounded-xl bg-amber-50 px-3 py-2">
                        <p className="text-gray-500 text-xs">Credits</p>
                        <Link to={shopDateLink} className="font-bold text-amber-600 mt-1 inline-block hover:underline">
                          {formatRs(summary.totalCredits)}
                        </Link>
                      </div>
                    </div>

                    <div className="rounded-xl bg-blue-50 px-3 py-3">
                      <p className="text-gray-500 text-xs">Profit</p>
                      <p className="font-bold text-blue-700 text-lg mt-1">{formatRs(calcProfit(code))}</p>
                      {(summary.reloadExpense || 0) > 0 && (
                        <p className="text-[10px] text-blue-700/80 mt-1">
                          Reload adjusted
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="card max-w-xl py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-gray-500" />
                <h2 className="text-sm font-semibold text-gray-700">Working Staff Today</h2>
              </div>
              <div className="text-2xl font-bold text-primary-700">{workingToday}</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
