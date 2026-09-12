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

// Robust normalization for name matching: remove spaces and symbols
const toMatchKey = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim()

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
            // Store by ID
            const uid = c.userId || c.user?.id
            if (uid) mapping[`id_${uid}`] = (mapping[`id_${uid}`] || 0) + amt
            // Store by Cleaned Name
            const name = c.userName || c.customerName || c.user?.name || c.name || c.staffName
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
    // 1. Try explicit field
    const fromRow = toNumber(row.unpaidCredits ?? row.creditsOwed ?? row.credits ?? row.creditOwned)
    if (fromRow > 0) return fromRow

    // 2. Lookup by ID
    const id = row.userId || row.user?.id || row.id
    if (id && creditsMap[`id_${id}`]) return creditsMap[`id_${id}`]

    // 3. Lookup by Normalized Name match
    const nameKey = toMatchKey(getSalaryName(row))
    if (creditsMap[`name_${nameKey}`]) return creditsMap[`name_${nameKey}`]

    // 4. Fuzzy match: staff name contains credit name or vice versa
    for (const key in creditsMap) {
      if (key.startsWith('name_')) {
        const cKey = key.replace('name_', '')
        if (nameKey.includes(cKey) || cKey.includes(nameKey)) return creditsMap[key]
      }
    }
    return 0
  }

  // ── FIX: 0 Days = 0 Salary ───────────────────────────────────────────────
  const getRowDays = (s) => toNumber(s.workDays ?? s.daysWorked ?? s.workingDays ?? s.totalWorkDays ?? s.days ?? 0)

  const getRowGross = (s) => {
    const days = getRowDays(s)
    if (days <= 0) return 0 // Business Rule: No days = No salary
    return toNumber(s.totalSalary ?? s.grossSalary ?? s.baseSalary ?? 0)
  }

  const getRowNet = (s) => {
    const gross = getRowGross(s)
    if (gross <= 0) return 0
    return Math.max(gross - getCredits(s), 0)
  }

  const sortedSalaries = [...monthlySalaries].sort((a, b) => {
    let aVal, bVal
    if (salarySortCol === 'name') {
      aVal = getSalaryName(a); bVal = getSalaryName(b)
    } else {
      aVal = getRowNet(a); bVal = getRowNet(b)
    }
    const factor = salarySortDir === 'asc' ? 1 : -1
    return aVal < bVal ? -factor : aVal > bVal ? factor : 0
  })

  const activeSalaries = sortedSalaries.filter(s => getRowDays(s) > 0)
  const todayAdmins = attendance.filter(a => a.workDate === dateStr && (a.userRole === 'ADMIN' || a.userRole === 'SUPERADMIN'))

  return (
    <div className="pb-10">
      <PageHeader title="Staff & HR" subtitle="Payroll and Attendance"
        action={<button onClick={load} className="btn-outline flex items-center gap-2 text-sm"><RefreshCw size={14}/> Refresh</button>}
      />

      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('attendance')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'attendance' ? 'bg-primary-700 text-white shadow-sm' : 'bg-white border text-gray-600'}`}>Attendance</button>
        {isSuperAdmin && <button onClick={() => setTab('salary')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'salary' ? 'bg-primary-700 text-white shadow-sm' : 'bg-white border text-gray-600'}`}>Salary</button>}
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
                  <div key={i} className="card flex items-center gap-3 py-3">
                    <div className={`p-2 rounded-full ${a.status === 'WORKING' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      {a.status === 'WORKING' ? <CheckCircle size={20}/> : <XCircle size={20}/>}
                    </div>
                    <div><p className="font-bold text-gray-800 text-sm">{a.userName}</p><p className="text-xs text-gray-500">{a.status}</p></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-white border rounded-2xl px-2 py-1.5 shadow-sm">
                <button onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronLeft size={16}/></button>
                <span className="text-sm font-bold px-4 min-w-[120px] text-center">{MONTHS[month-1]} {year}</span>
                <button onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))} disabled={isCurrentMonth} className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-30"><ChevronRight size={16}/></button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="card text-center py-4 bg-white border-gray-100 shadow-sm"><p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Staff</p><p className="text-2xl font-bold">{activeSalaries.length}</p></div>
              <div className="card text-center py-4 bg-white border-gray-100 shadow-sm"><p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Gross Salary</p><p className="text-2xl font-bold text-green-700">{formatRs(activeSalaries.reduce((sum,r) => sum + getRowGross(r), 0))}</p></div>
              <div className="card text-center py-4 bg-red-50 border-red-100 shadow-sm"><p className="text-xs text-red-600 font-bold uppercase tracking-wider">Credits</p><p className="text-2xl font-bold text-red-700">{formatRs(activeSalaries.reduce((sum,r) => sum + getCredits(r), 0))}</p></div>
              <div className="card text-center py-4 bg-primary-50 border-primary-100 shadow-sm"><p className="text-xs text-primary-700 font-bold uppercase tracking-wider">Net Payable</p><p className="text-2xl font-bold text-primary-800">{formatRs(activeSalaries.reduce((sum,r) => sum + getRowNet(r), 0))}</p></div>
            </div>

            <div className="card overflow-x-auto p-0 shadow-sm border-gray-100">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 border-b border-gray-100 font-bold uppercase">
                  <tr>
                    <th className="p-4 cursor-pointer hover:text-primary-700" onClick={() => { setSalarySortCol('name'); setSalarySortDir(salarySortDir === 'asc' ? 'desc' : 'asc') }}>Staff Member</th>
                    <th className="p-4 text-right">Work Days</th>
                    <th className="p-4 text-right">Gross Salary</th>
                    <th className="p-4 text-right text-red-600">Credits</th>
                    <th className="p-4 text-right text-primary-700 font-bold border-l border-gray-100 bg-primary-50/5">Net Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSalaries.length === 0 ? (
                    <tr><td colSpan="5" className="p-10 text-center text-gray-400">No data found</td></tr>
                  ) : (
                    sortedSalaries.map((s, i) => {
                      const days = getRowDays(s)
                      const creds = getCredits(s)
                      const gross = getRowGross(s)
                      const net = getRowNet(s)
                      return (
                        <tr key={i} className={`border-b last:border-0 border-gray-50 hover:bg-gray-50 ${days === 0 ? 'opacity-40 grayscale' : ''}`}>
                          <td className="p-4 font-bold text-gray-800">{getSalaryName(s)}{days === 0 && <span className="text-[10px] text-red-400 font-normal ml-2">(0 DAYS)</span>}</td>
                          <td className="p-4 text-right text-gray-600 font-bold">{days || '0'}</td>
                          <td className="p-4 text-right text-gray-600 font-medium">{formatRs(gross)}</td>
                          <td className="p-4 text-right text-red-600 font-bold">{creds > 0 ? `-${formatRs(creds)}` : <span className="text-gray-300">—</span>}</td>
                          <td className="p-4 text-right font-bold text-primary-700 bg-primary-50/10 border-l border-gray-100">{formatRs(net)}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  )
}
