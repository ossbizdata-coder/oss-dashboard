import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, DollarSign, CreditCard,
  Users, Coffee, BookOpen, UtensilsCrossed, RefreshCw,
  ChevronLeft, ChevronRight
} from 'lucide-react'
import { attendanceApi, dailyCashApi } from '../services/api.js'
import { StatCard, PageHeader, LoadingSpinner, formatRs } from '../components/ui.jsx'
import { format, subDays, addDays } from 'date-fns'
import useBusinessSettings from '../hooks/useBusinessSettings.js'
import { calculateCalculatedSales, calculateConfiguredProfit, calculateRevenue } from '../utils/businessSettings.js'

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
  const [businessSettings] = useBusinessSettings()

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
  const calcRevenue = (summary) => calculateRevenue(summary)
  const calcProfit = (shopCode) => calculateConfiguredProfit(shopCode, calcSales(shopSummaries[shopCode]), businessSettings)

  const totalSales = SHOPS.reduce((sum, shopCode) => sum + calcSales(shopSummaries[shopCode]), 0)
  const totalExpenses = SHOPS.reduce((sum, shopCode) => sum + (shopSummaries[shopCode]?.totalExpenses || 0), 0)
  const totalProfit = SHOPS.reduce((sum, shopCode) => sum + calcProfit(shopCode), 0)
  const totalDailyCredits = SHOPS.reduce((sum, shopCode) => sum + (shopSummaries[shopCode]?.totalCredits || 0), 0)

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
      <PageHeader
        title="Business Dashboard"
        action={(
          <button onClick={load} className="btn-outline flex items-center gap-2 text-sm">
            <RefreshCw size={15} /> Refresh
          </button>
        )}
      />

      {loadWarning && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {loadWarning}
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
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
        <span className="text-sm text-gray-500">
          {isToday ? 'Today' : format(selectedDate, 'EEE, MMM d, yyyy')}
        </span>
      </div>

      {loading ? <LoadingSpinner size="lg" /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard title="Revenue" value={formatRs(totalSales)} icon={TrendingUp} color="green" subtitle="All shops combined" />
            <StatCard title="Expenses" value={formatRs(totalExpenses)} icon={TrendingDown} color="red" subtitle="All shops combined" />
            <StatCard title="Profit" value={formatRs(totalProfit)} icon={DollarSign} color="blue" subtitle="Using settings profit rates" />
            <StatCard title="Credits" value={formatRs(totalDailyCredits)} icon={CreditCard} color="orange" subtitle="Credits given this day" />
          </div>

          <h2 className="text-base font-semibold text-gray-700 mb-3">
            Shop Summaries
            <span className="ml-2 text-xs font-normal text-gray-400">
              {isToday ? 'Today' : format(selectedDate, 'MMM d')}
            </span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {SHOP_CARDS.map(({ code, label, icon: Icon, border, text, bg }) => {
              const summary = shopSummaries[code] || {}
              const metrics = [
                { label: 'Total Revenue', value: calcRevenue(summary), valueClass: 'text-green-700' },
                { label: 'Total Expenses', value: summary.totalExpenses || 0, valueClass: 'text-red-600' },
                { label: 'Total Credits', value: summary.totalCredits || 0, valueClass: 'text-amber-600' },
                { label: 'Calculated Sales', value: calcSales(summary), valueClass: 'text-primary-700' },
                { label: 'Calculated Profit', value: calcProfit(code), valueClass: 'text-blue-700' },
              ]

              return (
                <Link key={code} to={`/shops/${code}`} className={`card hover:shadow-md transition-shadow border-l-4 ${border} group`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>
                      <Icon size={20} className="text-white" />
                    </div>
                    <h3 className={`font-semibold ${text}`}>{label}</h3>
                    <span className="ml-auto text-xs text-gray-400 group-hover:text-primary-600 transition-colors">View →</span>
                  </div>

                  <div className="space-y-3">
                    {metrics.map((metric) => (
                      <div key={metric.label} className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">{metric.label}</span>
                        <span className={`font-bold ${metric.valueClass}`}>{formatRs(metric.value)}</span>
                      </div>
                    ))}
                  </div>
                </Link>
              )
            })}
          </div>

          <div className="card max-w-xl">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              <Users size={16} className="inline mr-2" />Staff Today
              <span className="ml-1 text-xs font-normal text-gray-400">(Admin)</span>
            </h2>
            <div className="text-4xl font-bold text-primary-700 mb-1">{workingToday}</div>
            <div className="text-sm text-gray-500 mb-4">admins working {isToday ? 'today' : format(selectedDate, 'MMM d')}</div>
            <div className="space-y-2">
              {adminStaff.length === 0 ? (
                <p className="text-sm text-gray-400">No attendance records for this date</p>
              ) : adminStaff.slice(0, 8).map((item, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 font-medium">{item.userName || item.name || 'Staff'}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    (item.status === 'WORKING' || item.isWorking) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                  }`}>
                    {(item.status === 'WORKING' || item.isWorking) ? 'In' : 'Off'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
