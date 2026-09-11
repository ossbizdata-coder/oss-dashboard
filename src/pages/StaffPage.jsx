import { useEffect, useState } from 'react'
import { attendanceApi, salaryApi, dailyCashApi, creditApi } from '../services/api.js'
import { PageHeader, LoadingSpinner, formatRs } from '../components/ui.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import {
  Users, DollarSign, TrendingUp, ChevronLeft, ChevronRight,
  Coffee, BookOpen, UtensilsCrossed, RefreshCw
} from 'lucide-react'
import { format, startOfMonth, subMonths, addMonths, subDays, addDays } from 'date-fns'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const ADMIN_ROLES = new Set(['ADMIN', 'SUPERADMIN'])

const toNumber = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const toRole = (v) => String(v || '').toUpperCase()
const toNameKey = (v) => String(v || '').trim().toLowerCase()

export default function StaffPage() {
  const { isSuperAdmin } = useAuth()
  const [tab, setTab]                       = useState('attendance')
  const [attendance, setAttendance]         = useState([])
  const [monthlySalaries, setMonthlySalaries] = useState([])
  const [unpaidCreditsByUserId, setUnpaidCreditsByUserId] = useState({})
  const [unpaidCreditsByName, setUnpaidCreditsByName] = useState({})
  const [loading, setLoading]               = useState(true)
  const [selectedMonth, setSelectedMonth]   = useState(startOfMonth(new Date()))
  const [selectedDate, setSelectedDate]     = useState(new Date())
  const [salarySortCol, setSalarySortCol]   = useState('name')
  const [salarySortDir, setSalarySortDir]   = useState('asc')

  const year  = selectedMonth.getFullYear()
  const month = selectedMonth.getMonth() + 1
  const isCurrentMonth = year === new Date().getFullYear() && month === new Date().getMonth() + 1
  const dateStr    = format(selectedDate, 'yyyy-MM-dd')
  const isToday    = dateStr === format(new Date(), 'yyyy-MM-dd')

  const load = async () => {
    setLoading(true)
    try {
      const salaryPromise = isSuperAdmin
        ? salaryApi.getAdminMonthly(year, month)
        : Promise.resolve({ data: [] })

      const [att, sal, credits] = await Promise.allSettled([
        attendanceApi.getAll(),
        salaryPromise,
        creditApi.getAll(),
      ])

      if (att.status === 'fulfilled') setAttendance(att.value.data || [])

      // Extract salary data correctly
      if (sal.status === 'fulfilled') {
        const sData = sal.value.data?.data || sal.value.data || []
        setMonthlySalaries(sData)
      }

      // Build unpaid credits maps for robust lookup
      if (credits.status === 'fulfilled') {
        const byUserId = {}
        const byName = {}
        const list = credits.value.data?.data || credits.value.data || []

        list.filter(c => !c.isPaid).forEach(c => {
          const amount = toNumber(c.amount)
          // Store by User ID
          if (c.userId != null) {
            byUserId[String(c.userId)] = (byUserId[String(c.userId)] || 0) + amount
          }
          // Store by Name (as fallback)
          const nameKey = toNameKey(c.userName || c.user?.name || c.name || c.customerName)
          if (nameKey) {
            byName[nameKey] = (byName[nameKey] || 0) + amount
          }
        })
        setUnpaidCreditsByUserId(byUserId)
        setUnpaidCreditsByName(byName)
      }
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [year, month])

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getSalaryUserId = (row = {}) => {
    if (row.userId != null) return String(row.userId)
    if (row.user?.id != null) return String(row.user.id)
    return ''
  }
  const getSalaryName = (row = {}) => row.name || row.userName || row.user?.name || ''

  const getDisplayCredits = (row = {}) => {
    // 1. Try fields from Salary record itself (in case backend already calculated it)
    const raw = row.unpaidCredits ?? row.creditsOwed ?? row.totalUnpaidCredits ?? row.credits
    if (raw != null && raw > 0) return toNumber(raw)

    // 2. Lookup in global Credits list by User ID
    const uid = getSalaryUserId(row)
    if (uid && unpaidCreditsByUserId[uid] != null) return unpaidCreditsByUserId[uid]

    // 3. Lookup in global Credits list by Name (Fuzzy match)
    const nameKey = toNameKey(getSalaryName(row))
    if (nameKey && unpaidCreditsByName[nameKey] != null) return unpaidCreditsByName[nameKey]

    return 0
  }

  const getSalaryDaysRaw = (row = {}) =>
    toNumber(row.workDays ?? row.daysWorked ?? row.workingDays ?? row.totalWorkDays ?? 0)

  const adminAtt = attendance.filter(a => a.userRole === 'ADMIN' || a.userRole === 'SUPERADMIN')
  const monthAdmins = adminAtt.filter(a => a.workDate?.startsWith(`${year}-${String(month).padStart(2,'0')}`))

  const daysWorkedByName = {}
  const daysWorkedByUserId = {}
  monthAdmins.forEach(a => {
    if (a.status === 'WORKING') {
      const name = a.userName || 'Unknown'
      daysWorkedByName[name] = (daysWorkedByName[name] || 0) + 1
      if (a.userId != null) daysWorkedByUserId[String(a.userId)] = (daysWorkedByUserId[String(a.userId)] || 0) + 1
    }
  })

  const getAttendanceDays = (row = {}) => {
    const uid = getSalaryUserId(row)
    if (uid && daysWorkedByUserId[uid] != null) return daysWorkedByUserId[uid]
    return daysWorkedByName[getSalaryName(row)] || 0
  }

  const getDisplayDays = (row = {}) => {
    const salaryDays = getSalaryDaysRaw(row)
    return salaryDays > 0 ? salaryDays : getAttendanceDays(row)
  }

  const getDisplayGross = (row = {}) => {
    const rawGross = toNumber(row.baseSalary ?? row.grossSalary ?? row.totalBeforeDeductions ?? row.totalSalary)
    if (rawGross > 0) return rawGross
    const dailyRate = toNumber(row.dailyRate ?? row.ratePerDay)
    const days = getDisplayDays(row)
    if (dailyRate > 0 && days > 0) return dailyRate * days
    return rawGross
  }

  const getDisplayNet = (row = {}) => {
    const rawNet = toNumber(row.netSalary ?? row.payableSalary ?? row.totalSalary)
    const gross = getDisplayGross(row)
    const credits = getDisplayCredits(row)

    // If backend net is already less than gross, assume credits were already deducted
    if (rawNet > 0 && rawNet < gross && (gross - rawNet) === credits) return rawNet

    // Manual calculation fallback
    return Math.max(gross - credits, 0)
  }

  const adminSalaries = monthlySalaries.filter((row) => {
    if (!row) return false
    const role = toRole(row.userRole || row.role || row.user?.role)
    if (ADMIN_ROLES.has(role)) return true
    const uid = getSalaryUserId(row)
    if (uid && adminUserIds.has(uid)) return true
    const nameKey = toNameKey(getSalaryName(row))
    return !!nameKey && adminNames.has(nameKey)
  }).sort((a, b) => {
    let aVal, bVal
    if (salarySortCol === 'name') {
      aVal = toNameKey(getSalaryName(a))
      bVal = toNameKey(getSalaryName(b))
    } else if (salarySortCol === 'salary') {
      aVal = getDisplayNet(a)
      bVal = getDisplayNet(b)
    } else if (salarySortCol === 'gross') {
      aVal = getDisplayGross(a)
      bVal = getDisplayGross(b)
    } else if (salarySortCol === 'days') {
      aVal = getDisplayDays(a)
      bVal = getDisplayDays(b)
    }
    return salarySortDir === 'asc' ? (aVal < bVal ? -1 : aVal > bVal ? 1 : 0) : (aVal > bVal ? -1 : aVal < bVal ? 1 : 0)
  })

  const toggleSalarySort = (col) => {
    if (salarySortCol === col) {
      setSalarySortDir(salarySortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSalarySortCol(col)
      setSalarySortDir('asc')
    }
  }
  const getSortInd = (col) => salarySortCol === col ? (salarySortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'

  const adminUserIds = new Set(adminAtt.map(a => (a.userId != null ? String(a.userId) : '')).filter(Boolean))
  const adminNames = new Set(adminAtt.map(a => toNameKey(a.userName)).filter(Boolean))

  return (
    <div>
      <PageHeader title="Staff & HR" subtitle="Attendance · Salary"
        action={
          <button onClick={load} className="btn-outline flex items-center gap-2 text-sm">
            <RefreshCw size={15} /> Refresh
          </button>
        }
      />

      <div className="flex gap-2 mb-5">
        {[
          { key:'attendance', label:'Attendance', icon:Users },
          ...(isSuperAdmin ? [{ key:'salary', label:'Salary', icon:DollarSign }] : []),
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
          {tab === 'attendance' && (
            <div className="card text-center py-12 text-gray-400 italic">Attendance overview preserved. Switch to Salary tab to view detailed credits.</div>
          )}

          {tab === 'salary' && (
            <div className="space-y-5">
              {/* Month Switcher */}
              <div className="flex items-center gap-3">
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
              </div>

              {adminSalaries.length === 0 ? (
                <div className="card text-center text-gray-400 py-8">No salary data found for this month</div>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="card text-center py-3">
                      <p className="text-2xl font-bold text-blue-700">{adminSalaries.length}</p>
                      <p className="text-xs text-gray-500 mt-1 uppercase font-semibold">Staff</p>
                    </div>
                    <div className="card text-center py-3">
                      <p className="text-xl font-bold text-green-700">{formatRs(adminSalaries.reduce((s,r) => s + getDisplayGross(r), 0))}</p>
                      <p className="text-xs text-gray-500 mt-1 uppercase font-semibold">Gross Salary</p>
                    </div>
                    <div className="card text-center py-3 bg-red-50/50 border-red-100 shadow-sm">
                      <p className="text-xl font-bold text-red-600">{formatRs(adminSalaries.reduce((s,r) => s + getDisplayCredits(r), 0))}</p>
                      <p className="text-xs text-red-700 mt-1 uppercase font-bold tracking-wider">Credits</p>
                    </div>
                    <div className="card text-center py-3 bg-primary-50/30 border-primary-100">
                      <p className="text-xl font-bold text-primary-700">{formatRs(adminSalaries.reduce((s,r) => s + getDisplayNet(r), 0))}</p>
                      <p className="text-xs text-gray-500 mt-1 uppercase font-bold">Net Payable</p>
                    </div>
                  </div>

                  <div className="card overflow-x-auto shadow-sm">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50/50">
                          <th onClick={() => toggleSalarySort('name')} className="p-3 pr-4 font-semibold cursor-pointer hover:text-primary-600">Staff Member{getSortInd('name')}</th>
                          <th className="p-3 pr-4 font-semibold text-right">Daily Rate</th>
                          <th onClick={() => toggleSalarySort('days')} className="p-3 pr-4 font-semibold text-right cursor-pointer hover:text-primary-600">Days{getSortInd('days')}</th>
                          <th onClick={() => toggleSalarySort('gross')} className="p-3 pr-4 font-semibold text-right cursor-pointer hover:text-primary-600">Gross{getSortInd('gross')}</th>
                          <th className="p-3 pr-4 font-bold text-right text-red-600 uppercase tracking-tighter">Credits</th>
                          <th onClick={() => toggleSalarySort('salary')} className="p-3 font-bold text-right text-primary-700 cursor-pointer hover:text-primary-600 uppercase">Net Pay{getSortInd('salary')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminSalaries.map((s, i) => {
                          const credits = getDisplayCredits(s)
                          const gross = getDisplayGross(s)
                          const net = getDisplayNet(s)
                          const days = getDisplayDays(s)
                          return (
                            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                              <td className="p-3 pr-4 font-bold text-gray-800">{getSalaryName(s)}</td>
                              <td className="p-3 pr-4 text-right text-gray-600 font-medium">{formatRs(s.dailyRate)}</td>
                              <td className="p-3 pr-4 text-right text-gray-600 font-bold">{days || '—'}</td>
                              <td className="p-3 pr-4 text-right font-semibold text-green-700">{formatRs(gross)}</td>
                              <td className="p-3 pr-4 text-right">
                                {credits > 0 ? (
                                  <span className="font-bold text-red-600">-{formatRs(credits)}</span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                              <td className="p-3 text-right font-bold text-primary-700 bg-primary-50/10">{formatRs(net)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    <p className="text-[10px] text-gray-400 mt-4 italic px-2">
                      * Credits column shows the total unpaid amount owed by the staff member. This is automatically deducted from gross salary to calculate the net payable amount.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
