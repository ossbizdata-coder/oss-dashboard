import { useEffect, useState } from 'react'
import { attendanceApi, salaryApi, creditApi } from '../services/api.js'
import { PageHeader, LoadingSpinner, formatRs, EmptyState } from '../components/ui.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { Users, DollarSign, ChevronLeft, ChevronRight, RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import { format, startOfMonth, subMonths, addMonths, subDays, addDays } from 'date-fns'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const toNumber = (v) => {
  const n = parseFloat(v)
  return isNaN(n) ? 0 : n
}

const toKey = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim()

export default function StaffPage() {
  const { isSuperAdmin } = useAuth()
  const [tab, setTab]                       = useState('salary')
  const [attendance, setAttendance]         = useState([])
  const [monthlySalaries, setMonthlySalaries] = useState([])
  const [creditsMap, setCreditsMap]         = useState({})
  const [loading, setLoading]               = useState(true)
  const [selectedMonth, setSelectedMonth]   = useState(startOfMonth(new Date()))
  const [selectedDate, setSelectedDate]     = useState(new Date())
  const [salarySortCol, setSalarySortCol]   = useState('name')
  const [salarySortDir, setSalarySortDir]   = useState('asc')

  const year  = selectedMonth.getFullYear()
  const month = selectedMonth.getMonth() + 1
  const isCurrentMonth = year === new Date().getFullYear() && month === new Date().getMonth() + 1
  const dateStr = format(selectedDate, 'yyyy-MM-dd')
  const isToday = dateStr === format(new Date(), 'yyyy-MM-dd')

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
            if (c.userId) mapping[`id_${c.userId}`] = (mapping[`id_${c.userId}`] || 0) + amt
            const name = c.userName || c.customerName || c.user?.name || c.name || c.staffName
            const key = toKey(name)
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

  const getSalaryName = (row) => row?.name || row?.userName || row?.user?.name || row?.staffName || 'Unknown'

  const getCredits = (row) => {
    const fromRow = toNumber(row.unpaidCredits ?? row.creditsOwed ?? row.credits ?? row.creditOwned ?? row.totalUnpaidCredits)
    if (fromRow > 0) return fromRow

    const id = row.userId || row.user?.id || row.id || row.staffId
    if (id && creditsMap[`id_${id}`]) return creditsMap[`id_${id}`]

    const sNameKey = toKey(getSalaryName(row))
    if (creditsMap[`name_${sNameKey}`]) return creditsMap[`name_${sNameKey}`]

    for (const key in creditsMap) {
      if (key.startsWith('name_')) {
        const cName = key.replace('name_', '')
        if (sNameKey && (sNameKey.includes(cName) || cName.includes(sNameKey))) return creditsMap[key]
      }
    }
    return 0
  }

  const getRowDays = (s) => toNumber(s.workDays ?? s.daysWorked ?? s.workingDays ?? s.totalWorkDays ?? s.days ?? 0)

  const getRowGross = (s) => {
    if (getRowDays(s) <= 0) return 0
    return toNumber(s.totalSalary ?? s.grossSalary ?? s.baseSalary ?? 0)
  }

  const getRowNet = (s) => {
    const gross = getRowGross(s)
    if (gross <= 0) return 0
    return Math.max(gross - getCredits(s), 0)
  }

  // ── FILTER: Only show users with more than 0 work days ──────────────────
  const activeSalaries = monthlySalaries
    .filter(s => getRowDays(s) > 0)
    .sort((a, b) => {
      let aVal, bVal
      if (salarySortCol === 'name') {
        aVal = getSalaryName(a); bVal = getSalaryName(b)
      } else {
        aVal = getRowNet(a); bVal = getRowNet(b)
      }
      const factor = salarySortDir === 'asc' ? 1 : -1
      return aVal < bVal ? -factor : aVal > bVal ? factor : 0
    })

  const todayAdmins = attendance.filter(a => a.workDate === dateStr && (a.userRole === 'ADMIN' || a.userRole === 'SUPERADMIN'))

  return (
    <div className="pb-10">
      <PageHeader title="Staff & HR" subtitle="Attendance and Payroll"
        action={<button onClick={load} className="btn-outline flex items-center gap-2 text-sm"><RefreshCw size={14}/> Refresh</button>}
      />

      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('attendance')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'attendance' ? 'bg-primary-700 text-white shadow-sm' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>Attendance</button>
        {isSuperAdmin && <button onClick={() => setTab('salary')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'salary' ? 'bg-primary-700 text-white shadow-sm' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>Salary</button>}
      </div>

      {loading ? <LoadingSpinner /> : (
        tab === 'attendance' ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-white border rounded-2xl px-2 py-1.5 shadow-sm">
                <button onClick={() => setSelectedDate(subDays(selectedDate, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronLeft size={16}/></button>
                <input type="date" value={dateStr} max={format(new Date(), 'yyyy-MM-dd')} onChange={e => setSelectedDate(new Date(e.target.value))} className="text-sm font-bold bg-transparent outline-none px-2" />
                <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} disabled={isToday} className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-30"><ChevronRight size={16}/></button>
              </div>
            </div>
            {todayAdmins.length === 0 ? <EmptyState icon={Users} title="No Records" /> : (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {todayAdmins.map((a, i) => (
                  <div key={i} className="card flex items-center gap-3 py-3 shadow-sm hover:shadow-md transition-shadow">
                    <div className={`p-2 rounded-full ${a.status === 'WORKING' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      {a.status === 'WORKING' ? <CheckCircle size={20}/> : <XCircle size={20}/>}
                    </div>
                    <div><p className="font-bold text-gray-800 text-sm">{a.userName}</p><p className="text-xs text-gray-500 uppercase tracking-tighter">{a.status}</p></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Month Picker */}
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-white border rounded-2xl px-2 py-1.5 shadow-sm">
                <button onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronLeft size={16}/></button>
                <span className="text-sm font-bold px-4 min-w-[120px] text-center">{MONTHS[month-1]} {year}</span>
                <button onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))} disabled={isCurrentMonth} className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-30"><ChevronRight size={16}/></button>
              </div>
            </div>

            {/* Summary Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="card text-center py-4 bg-white border-gray-100 shadow-sm">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Staff Count</p>
                <p className="text-2xl font-bold text-gray-800">{activeSalaries.length}</p>
              </div>
              <div className="card text-center py-4 bg-white border-gray-100 shadow-sm">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Gross</p>
                <p className="text-2xl font-bold text-green-700">{formatRs(activeSalaries.reduce((sum,r) => sum + getRowGross(r), 0))}</p>
              </div>
              <div className="card text-center py-4 bg-red-50 border-red-100 shadow-sm">
                <p className="text-xs text-red-600 font-bold uppercase tracking-wider">Credits</p>
                <p className="text-2xl font-bold text-red-700">{formatRs(activeSalaries.reduce((sum,r) => sum + getCredits(r), 0))}</p>
              </div>
              <div className="card text-center py-4 bg-primary-50 border-primary-100 shadow-sm">
                <p className="text-xs text-primary-700 font-bold uppercase tracking-wider">Net Payable</p>
                <p className="text-2xl font-bold text-primary-800">{formatRs(activeSalaries.reduce((sum,r) => sum + getRowNet(r), 0))}</p>
              </div>
            </div>

            {/* Salary Table */}
            <div className="card overflow-x-auto p-0 shadow-sm border-gray-100">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-gray-50 text-gray-500 border-b border-gray-100 font-bold uppercase">
                  <tr>
                    <th className="p-4 cursor-pointer hover:text-primary-700 transition-colors" onClick={() => { setSalarySortCol('name'); setSalarySortDir(salarySortDir === 'asc' ? 'desc' : 'asc') }}>
                      Staff Member {salarySortCol === 'name' ? (salarySortDir === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="p-4 text-right">Work Days</th>
                    <th className="p-4 text-right">Gross Salary</th>
                    <th className="p-4 text-right text-red-600 font-bold uppercase tracking-tighter">Credits</th>
                    <th className="p-4 text-right text-primary-700 font-bold uppercase border-l border-gray-100 bg-primary-50/10">Net Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSalaries.length === 0 ? (
                    <tr><td colSpan="5" className="p-10 text-center text-gray-400 font-medium">No payroll records for staff with work days in this period</td></tr>
                  ) : (
                    activeSalaries.map((s, i) => {
                      const days = getRowDays(s)
                      const creds = getCredits(s)
                      const gross = getRowGross(s)
                      const net = getRowNet(s)
                      return (
                        <tr key={i} className="border-b last:border-0 border-gray-50 hover:bg-blue-50/20 transition-colors">
                          <td className="p-4">
                            <p className="font-bold text-gray-800">{getSalaryName(s)}</p>
                            <p className="text-[10px] text-gray-400 uppercase tracking-tighter">{s.userRole || s.role || 'Staff Member'}</p>
                          </td>
                          <td className="p-4 text-right text-gray-600 font-bold">{days}</td>
                          <td className="p-4 text-right text-gray-600 font-medium">{formatRs(gross)}</td>
                          <td className="p-4 text-right text-red-600 font-bold">
                            {creds > 0 ? `-${formatRs(creds)}` : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="p-4 text-right font-bold text-primary-700 bg-primary-50/5 border-l border-gray-100">
                            {formatRs(net)}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
              <div className="p-4 bg-gray-50/50 border-t border-gray-100">
                  <p className="text-[10px] text-gray-400 italic">
                      * Only staff with work days > 0 are shown. Credits column matches unpaid customer balances to staff. Gross is forced to 0 if days worked is 0.
                  </p>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  )
}
