import { useEffect, useState } from 'react'
import { attendanceApi, salaryApi, dailyCashApi, creditApi } from '../services/api.js'
import { PageHeader, LoadingSpinner, formatRs } from '../components/ui.jsx'
import {
  Users, DollarSign, TrendingUp, ChevronLeft, ChevronRight,
  Coffee, BookOpen, UtensilsCrossed, RefreshCw
} from 'lucide-react'
import { format, startOfMonth, subMonths, addMonths, subDays, addDays } from 'date-fns'

// ── Targets (from OSD app) ─────────────────────────────────────────────────
const MONTHLY_TARGETS = { CAFE: 343750, BOOKSHOP: 110000, FOODHUT: 214500 }
const DAILY_TARGETS   = { CAFE: 16000,  BOOKSHOP: 5000,   FOODHUT: 10000  }
const STAFF_SHOP = {
  CAFE:     { name: 'Dhammi',  icon: Coffee,          bg: 'bg-[#068A4B]', label: 'Cafe' },
  BOOKSHOP: { name: 'Vidusha', icon: BookOpen,        bg: 'bg-[#1565C0]', label: 'Bookshop' },
  FOODHUT:  { name: 'Piumi',   icon: UtensilsCrossed, bg: 'bg-[#B65505]', label: 'Food Hut' },
}
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const SHOPS  = ['CAFE','BOOKSHOP','FOODHUT']

const todayStr = () => format(new Date(), 'yyyy-MM-dd')

export default function StaffPage() {
  const [tab, setTab]                       = useState('employees')
  const [attendance, setAttendance]         = useState([])
  const [monthlySalaries, setMonthlySalaries] = useState([])
  const [monthlyShopData, setMonthlyShopData] = useState(null)
  const [todayShopData, setTodayShopData]   = useState({})
  const [unpaidCreditsMap, setUnpaidCreditsMap] = useState({}) // userId → totalUnpaid
  const [loading, setLoading]               = useState(true)
  const [selectedMonth, setSelectedMonth]   = useState(startOfMonth(new Date()))
  const [selectedDate, setSelectedDate]     = useState(new Date())

  const year  = selectedMonth.getFullYear()
  const month = selectedMonth.getMonth() + 1
  const isCurrentMonth = year === new Date().getFullYear() && month === new Date().getMonth() + 1
  const dateStr    = format(selectedDate, 'yyyy-MM-dd')
  const isToday    = dateStr === format(new Date(), 'yyyy-MM-dd')

  const load = async () => {
    setLoading(true)
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      const [att, sal, shopMonthly, credits, ...shopTodays] = await Promise.allSettled([
        attendanceApi.getAll(),
        salaryApi.getAdminMonthly(year, month),
        dailyCashApi.getMonthlySummary(year, month),
        creditApi.getAll(),
        ...SHOPS.map(c => dailyCashApi.getSummary(c, today)),
      ])
      if (att.status === 'fulfilled')         setAttendance(att.value.data || [])
      if (sal.status === 'fulfilled')         setMonthlySalaries(sal.value.data || [])
      if (shopMonthly.status === 'fulfilled') setMonthlyShopData(shopMonthly.value.data)
      // Build unpaid credits map: userId → total unpaid
      if (credits.status === 'fulfilled') {
        const map = {}
        ;(credits.value.data || []).filter(c => !c.isPaid).forEach(c => {
          if (c.userId) map[c.userId] = (map[c.userId] || 0) + (c.amount || 0)
        })
        setUnpaidCreditsMap(map)
      }
      const todayMap = {}
      shopTodays.forEach((r, i) => {
        if (r.status === 'fulfilled') todayMap[SHOPS[i]] = r.value.data
      })
      setTodayShopData(todayMap)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [year, month])

  // ── Helpers ───────────────────────────────────────────────────────────────
  const adminAtt = attendance.filter(a => a.userRole === 'ADMIN' || a.userRole === 'SUPERADMIN')

  // Selected date attendance — deduplicated
  const seenT = new Set()
  const todayAdmins = adminAtt
    .filter(a => a.workDate === dateStr)
    .filter(a => { const k = a.userId ?? a.userEmail; if (seenT.has(k)) return false; seenT.add(k); return true })

  // Selected month — deduplicated
  const monthPrefix = `${year}-${String(month).padStart(2,'0')}`
  const seenM = new Set()
  const monthAdmins = adminAtt
    .filter(a => a.workDate?.startsWith(monthPrefix))
    .filter(a => { const k = `${a.userId??a.userEmail}_${a.workDate}`; if (seenM.has(k)) return false; seenM.add(k); return true })

  const daysWorkedByName = {}
  monthAdmins.forEach(a => {
    if (a.status === 'WORKING') daysWorkedByName[a.userName] = (daysWorkedByName[a.userName] || 0) + 1
  })

  const adminUserIds = new Set(adminAtt.map(a => a.userId).filter(Boolean))
  const adminSalaries = monthlySalaries.filter(s => adminUserIds.has(s.userId) || adminUserIds.size === 0)

  const workingCount    = todayAdmins.filter(a => a.status === 'WORKING').length
  const notWorkingCount = todayAdmins.filter(a => a.status !== 'WORKING').length

  return (
    <div>
      <PageHeader title="Staff & HR" subtitle="Employees · Salary · Performance"
        action={
          <button onClick={load} className="btn-outline flex items-center gap-2 text-sm">
            <RefreshCw size={15} /> Refresh
          </button>
        }
      />

      {/* Month Switcher — only for Salary / Performance */}
      {(tab === 'salary' || tab === 'performance') && (
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center bg-white border border-gray-200 rounded-2xl px-2 py-1.5 gap-1 shadow-sm">
            <button onClick={() => setSelectedMonth(d => startOfMonth(subMonths(d, 1)))}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-gray-700 px-3 min-w-[110px] text-center">
              {MONTHS[month-1]} {year}
            </span>
            <button onClick={() => setSelectedMonth(d => startOfMonth(addMonths(d, 1)))}
              disabled={isCurrentMonth}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30">
              <ChevronRight size={16} />
            </button>
          </div>
          {!isCurrentMonth && (
            <button onClick={() => setSelectedMonth(startOfMonth(new Date()))}
              className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-full font-medium">
              This Month
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {[
          { key:'employees',   label:'Employees',   icon:Users },
          { key:'salary',      label:'Salary',      icon:DollarSign },
          { key:'performance', label:'Performance', icon:TrendingUp },
        ].map(({ key, label, icon:Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === key ? 'bg-primary-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          {/* ══════════ TAB 1: EMPLOYEES ══════════ */}
          {tab === 'employees' && (
            <div className="space-y-5">
              {/* Date switcher */}
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-white border border-gray-200 rounded-2xl px-2 py-1.5 gap-1 shadow-sm">
                  <button onClick={() => setSelectedDate(d => subDays(d, 1))}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                    <ChevronLeft size={16} />
                  </button>
                  <input
                    type="date"
                    value={dateStr}
                    max={format(new Date(), 'yyyy-MM-dd')}
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
                <span className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">{workingCount} Working</span>
                <span className="bg-red-100 text-red-600 text-xs font-semibold px-3 py-1 rounded-full">{notWorkingCount} Off</span>
              </div>

              {todayAdmins.length === 0 ? (
                <div className="card text-center text-gray-400 py-8">
                  No attendance records for {isToday ? 'today' : format(selectedDate, 'MMM d, yyyy')}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {todayAdmins.map((a, i) => (
                    <div key={i} className="card flex items-center gap-3 py-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                        a.status === 'WORKING' ? 'bg-green-500' : 'bg-red-400'
                      }`}>
                        {(a.userName || 'S').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 text-sm truncate">{a.userName || '—'}</p>
                        <span className={`text-xs font-medium ${a.status === 'WORKING' ? 'text-green-600' : 'text-red-500'}`}>
                          {a.status === 'WORKING' ? '✓ Working' : '✗ Day Off'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="card">
                <h3 className="font-semibold text-gray-700 mb-4">
                  Monthly Attendance
                  <span className="ml-2 text-xs font-normal text-gray-400">{MONTHS[month-1]} {year}</span>
                </h3>
                {Object.keys(daysWorkedByName).length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">No data for {MONTHS[month-1]}</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(daysWorkedByName).sort((a,b) => b[1]-a[1]).map(([name, days]) => (
                      <div key={name} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs flex-shrink-0">
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-0.5">
                            <span className="text-sm font-medium text-gray-700">{name}</span>
                            <span className="text-sm font-bold text-primary-700">{days} days</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full">
                            <div className="h-1.5 bg-primary-500 rounded-full" style={{ width:`${Math.min((days/26)*100,100)}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════ TAB 2: SALARY ══════════ */}
          {tab === 'salary' && (
            <div className="space-y-5">
              {adminSalaries.length === 0 ? (
                <div className="card text-center text-gray-400 py-8">No salary data for {MONTHS[month-1]} {year}</div>
              ) : (
                <>
                  {/* Summary tiles */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="card text-center py-3 bg-gradient-to-br from-blue-50 to-white border-blue-100">
                      <p className="text-2xl font-bold text-blue-700">{adminSalaries.length}</p>
                      <p className="text-xs text-gray-500 mt-1">Staff</p>
                    </div>
                    <div className="card text-center py-3 bg-gradient-to-br from-green-50 to-white border-green-100">
                      <p className="text-xl font-bold text-green-700">{formatRs(adminSalaries.reduce((s,r) => s+(r.totalSalary||0),0))}</p>
                      <p className="text-xs text-gray-500 mt-1">Gross Salary</p>
                    </div>
                    <div className="card text-center py-3 bg-gradient-to-br from-red-50 to-white border-red-100">
                      <p className="text-xl font-bold text-red-600">
                        {formatRs(adminSalaries.reduce((s,r) => s+(unpaidCreditsMap[r.userId]||0),0))}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Credits Deduction</p>
                    </div>
                    <div className="card text-center py-3 bg-gradient-to-br from-purple-50 to-white border-purple-100">
                      <p className="text-xl font-bold text-purple-700">
                        {formatRs(adminSalaries.reduce((s,r) => s+Math.max((r.totalSalary||0)-(unpaidCreditsMap[r.userId]||0),0),0))}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Net Payable</p>
                    </div>
                  </div>

                  <div className="card overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-100">
                          <th className="pb-3 pr-4 font-medium">Name</th>
                          <th className="pb-3 pr-4 font-medium text-right">Daily Rate</th>
                          <th className="pb-3 pr-4 font-medium text-right">Days</th>
                          <th className="pb-3 pr-4 font-medium text-right">Overtime</th>
                          <th className="pb-3 pr-4 font-medium text-right">Gross</th>
                          <th className="pb-3 pr-4 font-medium text-right text-red-500">Credits Owed</th>
                          <th className="pb-3 font-medium text-right text-purple-600">Net Pay</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminSalaries.map((s, i) => {
                          const owed   = unpaidCreditsMap[s.userId] || 0
                          const net    = Math.max((s.totalSalary || 0) - owed, 0)
                          return (
                            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="py-3 pr-4 font-medium text-gray-800">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold">
                                    {(s.name||'?').charAt(0)}
                                  </div>
                                  {s.name}
                                </div>
                              </td>
                              <td className="py-3 pr-4 text-right text-gray-600">{formatRs(s.dailyRate)}</td>
                              <td className="py-3 pr-4 text-right text-gray-600">{s.workDays ?? '—'}</td>
                              <td className="py-3 pr-4 text-right text-gray-500 text-xs">
                                {(s.totalOvertimeHours||0) > 0 ? `+${s.totalOvertimeHours}h` : '—'}
                              </td>
                              <td className="py-3 pr-4 text-right font-semibold text-green-700">{formatRs(s.totalSalary)}</td>
                              <td className="py-3 pr-4 text-right">
                                {owed > 0
                                  ? <span className="font-semibold text-red-600">- {formatRs(owed)}</span>
                                  : <span className="text-gray-300">—</span>
                                }
                              </td>
                              <td className="py-3 text-right font-bold text-purple-700">{formatRs(net)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    <p className="text-xs text-gray-400 mt-3 pt-3 border-t">
                      * Credits Owed = current unpaid credits balance for each staff member. Deducted automatically from gross salary to show net payable.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══════════ TAB 3: PERFORMANCE ══════════ */}
          {tab === 'performance' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {SHOPS.map(code => {
                  const meta       = STAFF_SHOP[code]
                  const Icon       = meta.icon
                  const monthly    = monthlyShopData?.shops?.find(s => s.shopCode === code) || {}
                  const todayD     = todayShopData[code]
                  const mTarget    = MONTHLY_TARGETS[code]
                  const dTarget    = DAILY_TARGETS[code]
                  const mSales     = monthly.totalSales || 0
                  const tSales     = todayD?.totalSales || 0
                  const pct        = mTarget > 0 ? Math.min((mSales/mTarget)*100,100) : 0
                  const tPct       = dTarget > 0 ? Math.min((tSales/dTarget)*100,100) : 0
                  const shortfall  = Math.max(mTarget-mSales,0)
                  const overPerf   = Math.max(mSales-mTarget,0)
                  const bonus      = overPerf * 0.05
                  const achieved   = mSales >= mTarget

                  return (
                    <div key={code} className="card">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-10 h-10 ${meta.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                          <Icon size={20} className="text-white" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">{meta.name}</p>
                          <p className="text-xs text-gray-400">{meta.label}</p>
                        </div>
                        {achieved && <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">🎉 Met!</span>}
                      </div>

                      {/* Monthly progress */}
                      <div className="mb-4">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Monthly Target</span>
                          <span className="font-semibold text-gray-700">{pct.toFixed(0)}%</span>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-3 rounded-full transition-all ${achieved ? 'bg-green-500' : pct >= 70 ? 'bg-yellow-400' : 'bg-red-400'}`}
                            style={{ width:`${pct}%` }} />
                        </div>
                        <div className="flex justify-between text-xs mt-1">
                          <span className="text-gray-500">Sales: <span className="font-bold text-gray-700">{formatRs(mSales)}</span></span>
                          <span className="text-gray-400">of {formatRs(mTarget)}</span>
                        </div>
                      </div>

                      {/* Today */}
                      <div className="bg-gray-50 rounded-xl p-3 mb-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Today</span>
                          <span className="font-semibold">{tPct.toFixed(0)}% of daily target</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-1">
                          <div className={`h-2 rounded-full ${tSales >= dTarget ? 'bg-green-500' : 'bg-blue-400'}`}
                            style={{ width:`${tPct}%` }} />
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="font-bold text-gray-700">{formatRs(tSales)}</span>
                          <span className="text-gray-400">target {formatRs(dTarget)}</span>
                        </div>
                      </div>

                      {/* Result */}
                      <div className="space-y-1.5 text-xs">
                        {shortfall > 0 && (
                          <div className="flex justify-between">
                            <span className="text-red-500">Shortfall</span>
                            <span className="font-semibold text-red-600">{formatRs(shortfall)}</span>
                          </div>
                        )}
                        {overPerf > 0 && <>
                          <div className="flex justify-between">
                            <span className="text-green-600">Over-performance</span>
                            <span className="font-semibold text-green-700">{formatRs(overPerf)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-purple-600">Est. Bonus (5%)</span>
                            <span className="font-semibold text-purple-700">{formatRs(bonus)}</span>
                          </div>
                        </>}
                        <div className="flex justify-between border-t pt-1.5 mt-1">
                          <span className="text-gray-400">Days recorded</span>
                          <span className="font-medium text-gray-600">{monthly.daysRecorded ?? 0}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-gray-400 text-center">
                Monthly targets — CAFE {formatRs(MONTHLY_TARGETS.CAFE)} · Bookshop {formatRs(MONTHLY_TARGETS.BOOKSHOP)} · FoodHut {formatRs(MONTHLY_TARGETS.FOODHUT)} · Bonus = 5% over-performance
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

