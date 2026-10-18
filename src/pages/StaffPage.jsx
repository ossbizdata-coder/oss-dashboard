import { useEffect, useState } from 'react'
import { attendanceApi, salaryApi, creditApi } from '../services/api.js'
import { PageHeader, LoadingSpinner, formatRs, EmptyState } from '../components/ui.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { Users, DollarSign, ChevronLeft, ChevronRight, RefreshCw, Clock, MapPin, ChevronDown, ChevronUp, UserCheck, UserX } from 'lucide-react'
import { format, startOfMonth, subMonths, addMonths, eachDayOfInterval, endOfMonth, isSameMonth, isAfter, startOfDay } from 'date-fns'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const toNumber = (v) => {
  const n = parseFloat(v)
  return isNaN(n) ? 0 : n
}

const normalize = (v) => String(v || '').toLowerCase().trim()
const toMatchKey = (v) => normalize(v).replace(/\s+/g, '')

export default function StaffPage() {
  const { isSuperAdmin } = useAuth()
  const [tab, setTab]                       = useState('attendance')
  const [attendance, setAttendance]         = useState([])
  const [monthlySalaries, setMonthlySalaries] = useState([])
  const [creditsMap, setCreditsMap]         = useState({})
  const [loading, setLoading]               = useState(true)
  const [selectedMonth, setSelectedMonth]   = useState(startOfMonth(new Date()))
  const [salarySortCol, setSalarySortCol]   = useState('name')
  const [salarySortDir, setSalarySortDir]   = useState('asc')
  const [expandedUsers, setExpandedUsers]   = useState({})

  const year  = selectedMonth.getFullYear()
  const month = selectedMonth.getMonth() + 1
  const isCurrentMonth = isSameMonth(selectedMonth, new Date())

  const load = async () => {
    setLoading(true)
    try {
      const salaryPromise = isSuperAdmin ? salaryApi.getAdminMonthly(year, month) : Promise.resolve({ data: [] })
      const [att, sal, creds] = await Promise.allSettled([
        attendanceApi.getAll(),
        salaryPromise,
        creditApi.getAll()
      ])

      if (att.status === 'fulfilled') setAttendance(att.value.data || [])
      if (sal.status === 'fulfilled') {
        const sData = sal.value.data?.data || sal.value.data || []
        setMonthlySalaries(Array.isArray(sData) ? sData : [])
      }

      if (creds.status === 'fulfilled') {
        const cList = creds.value.data?.data || creds.value.data || []
        const mapping = {}
        if (Array.isArray(cList)) {
          cList.forEach(c => {
            if (c.isPaid) return
            const amt = toNumber(c.amount)
            const uid = c.userId || c.user?.id
            if (uid) mapping[`id_${uid}`] = (mapping[`id_${uid}`] || 0) + amt
            const name = c.userName || c.customerName || c.user?.name || c.name
            const key = toMatchKey(name)
            if (key) mapping[`name_${key}`] = (mapping[`name_${key}`] || 0) + amt
          })
        }
        setCreditsMap(mapping)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [year, month])

  const getSalaryName = (row) => row?.name || row?.userName || row?.user?.name || 'Unknown'

  const getCredits = (row) => {
    const id = row.userId || row.user?.id || row.id
    if (id && creditsMap[`id_${id}`]) return creditsMap[`id_${id}`]
    const nameKey = toMatchKey(getSalaryName(row))
    if (creditsMap[`name_${nameKey}`]) return creditsMap[`name_${nameKey}`]
    return toNumber(row.unpaidCredits ?? row.creditsOwed ?? row.credits)
  }

  const getRowDays = (s) => toNumber(s.workDays ?? s.daysWorked ?? s.workingDays ?? s.totalWorkDays ?? s.days ?? 0)
  const getRowDailyRate = (s) => toNumber(s.dailyRate ?? s.dailySalary ?? 0)
  const getRowHourlyRate = (s) => {
    const explicit = toNumber(s.hourlyRate ?? s.hourly_rate ?? 0)
    if (explicit > 0) return explicit
    const daily = getRowDailyRate(s)
    return daily > 0 ? daily / 8.0 : 0
  }
  const getRowDeductionRate = (s) => toNumber(s.deductionRatePerHour ?? s.deductionRate ?? s.deduction_rate_per_hour ?? getRowHourlyRate(s))
  const getRowOvertimeHours = (s) => toNumber(s.totalOvertimeHours ?? s.overtimeHours ?? s.otHours ?? 0)
  const getRowDeductionHours = (s) => toNumber(s.totalDeductionHours ?? s.deductionHours ?? s.offWorkHours ?? 0)
  const getRowBaseSalary = (s) => {
    const base = toNumber(s.baseSalary ?? 0)
    const derived = getRowDailyRate(s) * getRowDays(s)
    return getRowDays(s) > 0 ? Math.max(base > 0 ? base : derived, 0) : 0
  }
  const getRowOvertimeAmount = (s) => getRowOvertimeHours(s) * getRowHourlyRate(s)
  const getRowDeductionAmount = (s) => getRowDeductionHours(s) * getRowDeductionRate(s)
  const getRowGross = (s) => {
    const gross = getRowBaseSalary(s) + getRowOvertimeAmount(s) - getRowDeductionAmount(s)
    return getRowDays(s) > 0 ? Math.max(gross, 0) : 0
  }
  const getRowNet = (s) => {
    const gross = getRowGross(s)
    return gross > 0 ? Math.max(gross - getCredits(s), 0) : 0
  }

  const sortedSalaries = [...monthlySalaries].filter(s => getRowDays(s) > 0).sort((a, b) => {
    let aVal, bVal
    if (salarySortCol === 'name') {
      aVal = normalize(getSalaryName(a)); bVal = normalize(getSalaryName(b))
    } else {
      aVal = getRowNet(a); bVal = getRowNet(b)
    }
    const factor = salarySortDir === 'asc' ? 1 : -1
    return aVal < bVal ? -factor : aVal > bVal ? factor : 0
  })

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(selectedMonth),
    end: endOfMonth(selectedMonth)
  }).reverse()

  const groupedAttendance = [...attendance].reduce((acc, row) => {
    const userId = row.userId ?? row.user?.id ?? row.id
    const userName = row.userName || row.user?.name || 'Unknown'
    const key = `user_${userId ?? userName}`
    if (!acc[key]) {
      acc[key] = {
        key,
        userId,
        userName,
        userRole: row.userRole || row.role || 'Staff Member',
        records: []
      }
    }
    acc[key].records.push(row)
    return acc
  }, {})

  const sortedGroupedAttendance = Object.values(groupedAttendance).sort((a, b) => normalize(a.userName).localeCompare(normalize(b.userName)))

  const toggleUser = (key) => {
    setExpandedUsers(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="pb-10">
      <PageHeader title="Staff & HR" subtitle="Attendance and Payroll"
        action={(
          <>
            <div className="flex items-center bg-white border rounded-2xl px-2 py-1.5 shadow-sm">
              <button onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronLeft size={16}/></button>
              <span className="text-sm font-bold px-4 min-w-[120px] text-center">{MONTHS[month-1]} {year}</span>
              <button onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))} disabled={isCurrentMonth} className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-30"><ChevronRight size={16}/></button>
            </div>
            <button onClick={load} className="btn-outline flex items-center gap-2 text-sm"><RefreshCw size={14}/> Refresh</button>
          </>
        )}
      />

      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('attendance')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'attendance' ? 'bg-primary-700 text-white shadow-sm' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>Attendance</button>
        {isSuperAdmin && <button onClick={() => setTab('salary')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'salary' ? 'bg-primary-700 text-white shadow-sm' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>Salary</button>}
      </div>

      {loading ? <LoadingSpinner /> : (
        tab === 'attendance' ? (
          <div className="space-y-3">
            {sortedGroupedAttendance.map((group) => {
              const workingDates = group.records.filter(row => row.status === 'WORKING' || row.isWorking === true)
              const isExpanded = !!expandedUsers[group.key]

              return (
                <div key={group.key} className="card p-0 overflow-hidden border-gray-100 shadow-sm transition-all bg-white">
                  <button
                    onClick={() => toggleUser(group.key)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50 text-blue-700 font-bold">{group.userName.split(' ').map(part => part[0]).join('').slice(0,2).toUpperCase() || 'U'}</div>
                      <div>
                       <p className="font-bold text-gray-800">{group.userName}</p>
                       <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{group.userRole}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="bg-green-50 text-green-700 px-2.5 py-1 rounded-full text-xs font-bold">{workingDates.length} working days</span>
                      {isExpanded ? <ChevronUp size={18} className="text-primary-600"/> : <ChevronDown size={18} className="text-gray-400"/>}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50/50 p-4">
                      {workingDates.length === 0 ? (
                       <p className="text-sm text-gray-400 italic text-center py-2">No working dates found for this user.</p>
                      ) : (
                       <div className="space-y-3">
                         {workingDates.map((row, idx) => {
                           const dateValue = row.workDate || row.date || 'Unknown'
                           const overtimeHours = toNumber(row.overtimeHours ?? row.otHours ?? 0)
                           const deductionHours = toNumber(row.deductionHours ?? row.offWorkHours ?? row.offOfficeHours ?? row.outsideHours ?? 0)

                           return (
                             <div key={`${group.key}-${idx}`} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
                               <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                 <div>
                                   <p className="font-bold text-gray-800">{dateValue}</p>
                                   <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase inline-block ${row.status === 'WORKING' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                     {row.status || (row.isWorking ? 'WORKING' : 'NOT_WORKING')}
                                   </span>
                                 </div>
                                 <div className="flex items-center gap-2 text-right">
                                   <div className="flex items-center gap-1.5 text-blue-600 font-bold text-[11px] justify-end bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                                     <Clock size={12}/> OT: {overtimeHours}h
                                   </div>
                                   <div className="flex items-center gap-1.5 text-purple-600 font-bold text-[11px] justify-end bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-100">
                                     <MapPin size={12}/> OFF: {deductionHours}h
                                   </div>
                                 </div>
                               </div>

                               {(row.overtimeReason || row.deductionReason) && (
                                 <div className="mt-2 text-xs text-gray-500 space-y-1">
                                   {row.overtimeReason && <div><span className="font-semibold text-blue-600">OT:</span> {row.overtimeReason}</div>}
                                   {row.deductionReason && <div><span className="font-semibold text-purple-600">Off work:</span> {row.deductionReason}</div>}
                                 </div>
                               )}
                             </div>
                           )
                         })}
                       </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="card text-center py-4 bg-white border-gray-100 shadow-sm"><p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Staff</p><p className="text-2xl font-bold text-gray-800">{sortedSalaries.length}</p></div>
              <div className="card text-center py-4 bg-white border-gray-100 shadow-sm"><p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Gross</p><p className="text-2xl font-bold text-green-700">{formatRs(sortedSalaries.reduce((sum,r) => sum + getRowGross(r), 0))}</p></div>
              <div className="card text-center py-4 bg-red-50 border-red-100 shadow-sm"><p className="text-xs text-red-600 font-bold uppercase tracking-wider">Credits</p><p className="text-2xl font-bold text-red-700">{formatRs(sortedSalaries.reduce((sum,r) => sum + getCredits(r), 0))}</p></div>
              <div className="card text-center py-4 bg-primary-50 border-primary-100 shadow-sm"><p className="text-xs text-primary-700 font-bold uppercase tracking-wider">Net Payable</p><p className="text-2xl font-bold text-primary-800">{formatRs(sortedSalaries.reduce((sum,r) => sum + getRowNet(r), 0))}</p></div>
            </div>
            <div className="card overflow-x-auto p-0 shadow-sm border-gray-100">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-gray-50 text-gray-500 border-b border-gray-100 font-bold uppercase">
                  <tr>
                    <th className="p-4 cursor-pointer hover:text-primary-700" onClick={() => { setSalarySortCol('name'); setSalarySortDir(salarySortDir === 'asc' ? 'desc' : 'asc') }}>Staff Member</th>
                    <th className="p-4 text-right">Work Days</th>
                    <th className="p-4 text-right text-gray-700">Base</th>
                    <th className="p-4 text-right text-blue-600">OT</th>
                    <th className="p-4 text-right text-purple-600">Deductions</th>
                    <th className="p-4 text-right">Gross</th>
                    <th className="p-4 text-right text-red-600">Credits</th>
                    <th className="p-4 text-right text-primary-700 font-bold border-l border-gray-100 bg-primary-50/5">Net Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSalaries.map((s, i) => (
                    <tr key={i} className="border-b last:border-0 border-gray-50 hover:bg-blue-50/20 transition-colors">
                      <td className="p-4"><p className="font-bold text-gray-800">{getSalaryName(s)}</p><p className="text-[10px] text-gray-400 uppercase tracking-tighter">{s.userRole || s.role || 'Staff Member'}</p></td>
                      <td className="p-4 text-right text-gray-600 font-bold">{getRowDays(s)}</td>
                      <td className="p-4 text-right text-gray-700 font-medium">{formatRs(getRowBaseSalary(s))}</td>
                      <td className="p-4 text-right text-blue-600 font-medium">{formatRs(getRowOvertimeAmount(s))}</td>
                      <td className="p-4 text-right text-purple-600 font-medium">{formatRs(getRowDeductionAmount(s))}</td>
                      <td className="p-4 text-right text-gray-600 font-medium">{formatRs(getRowGross(s))}</td>
                      <td className="p-4 text-right text-red-600 font-bold">{getCredits(s) > 0 ? `-${formatRs(getCredits(s))}` : <span className="text-gray-300">—</span>}</td>
                      <td className="p-4 text-right font-bold text-primary-700 bg-primary-50/10 border-l border-gray-100">{formatRs(getRowNet(s))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  )
}
