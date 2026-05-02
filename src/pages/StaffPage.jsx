import { useEffect, useState } from 'react'
import { attendanceApi, salaryApi } from '../services/api.js'
import { PageHeader, LoadingSpinner, RoleBadge, EmptyState, formatRs } from '../components/ui.jsx'
import { Users, Calendar } from 'lucide-react'
import { format } from 'date-fns'

export default function StaffPage() {
  const [tab, setTab] = useState('attendance')
  const [attendance, setAttendance] = useState([])
  const [salaries, setSalaries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([
      attendanceApi.getAll(),
      salaryApi.getAll(),
    ]).then(([att, sal]) => {
      if (att.status === 'fulfilled') setAttendance(att.value.data || [])
      if (sal.status === 'fulfilled') setSalaries(sal.value.data || [])
      setLoading(false)
    })
  }, [])

  const workingToday = attendance.filter(a => a.status === 'WORKING').length
  const notWorkingToday = attendance.filter(a => a.status === 'NOT_WORKING').length

  return (
    <div>
      <PageHeader
        title="Staff & HR"
        subtitle="Manage attendance, view salaries, and staff performance"
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="card text-center py-4">
          <p className="text-3xl font-bold text-green-600">{workingToday}</p>
          <p className="text-sm text-gray-500 mt-1">Working Today</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-3xl font-bold text-red-500">{notWorkingToday}</p>
          <p className="text-sm text-gray-500 mt-1">Day Off</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-3xl font-bold text-gray-700">{attendance.length}</p>
          <p className="text-sm text-gray-500 mt-1">Total Records</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-3xl font-bold text-primary-700">{salaries.length}</p>
          <p className="text-sm text-gray-500 mt-1">Staff with Salary</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {['attendance', 'salaries'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors capitalize ${
              tab === t
                ? 'bg-primary-700 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t === 'attendance' ? <><Calendar size={14} className="inline mr-1" />Attendance</> : <><Users size={14} className="inline mr-1" />Salaries</>}
          </button>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="card">
          {tab === 'attendance' && (
            attendance.length === 0
              ? <EmptyState icon={Users} title="No attendance records" />
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="pb-3 pr-4 font-medium">Name</th>
                        <th className="pb-3 pr-4 font-medium">Date</th>
                        <th className="pb-3 pr-4 font-medium">Status</th>
                        <th className="pb-3 pr-4 font-medium">Check In</th>
                        <th className="pb-3 font-medium">Overtime</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.slice(0, 50).map((a, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-3 pr-4 font-medium text-gray-800">{a.userName || a.name || '—'}</td>
                          <td className="py-3 pr-4 text-gray-500">{a.workDate || '—'}</td>
                          <td className="py-3 pr-4">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              a.status === 'WORKING' ? 'bg-green-100 text-green-700' :
                              a.status === 'HALF_DAY' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-600'
                            }`}>
                              {a.status?.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-gray-500 text-xs">
                            {a.checkInTime ? format(new Date(a.checkInTime), 'HH:mm') : '—'}
                          </td>
                          <td className="py-3 text-gray-500">
                            {a.overtimeHours > 0 ? `+${a.overtimeHours}h` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
          )}

          {tab === 'salaries' && (
            salaries.length === 0
              ? <EmptyState icon={Users} title="No salary records" />
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="pb-3 pr-4 font-medium">Name</th>
                        <th className="pb-3 pr-4 font-medium">Role</th>
                        <th className="pb-3 pr-4 font-medium text-right">Daily Wage</th>
                        <th className="pb-3 pr-4 font-medium text-right">Working Days</th>
                        <th className="pb-3 font-medium text-right">Total Salary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salaries.map((s, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-3 pr-4 font-medium text-gray-800">{s.name || s.userName}</td>
                          <td className="py-3 pr-4"><RoleBadge role={s.role} /></td>
                          <td className="py-3 pr-4 text-right">{formatRs(s.dailyWage)}</td>
                          <td className="py-3 pr-4 text-right text-gray-600">{s.workingDays || '—'}</td>
                          <td className="py-3 text-right font-bold text-green-700">{formatRs(s.totalSalary)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
          )}
        </div>
      )}
    </div>
  )
}

