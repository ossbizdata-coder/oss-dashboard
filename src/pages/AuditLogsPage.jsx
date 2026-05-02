import { useEffect, useState } from 'react'
import { auditApi } from '../services/api.js'
import { PageHeader, LoadingSpinner, EmptyState, Badge } from '../components/ui.jsx'
import { Shield, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'

const ACTION_COLORS = {
  LOGIN: 'blue',
  CREATE: 'green',
  UPDATE: 'yellow',
  DELETE: 'red',
  LOGOUT: 'gray',
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await auditApi.getAll()
      setLogs(res.data || [])
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = logs.filter(l =>
    !search || [l.userName, l.action, l.entityType, l.description].some(
      v => v?.toLowerCase().includes(search.toLowerCase())
    )
  )

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        subtitle="Full system activity trail — all user actions"
        action={
          <button onClick={load} className="btn-outline flex items-center gap-2 text-sm">
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />

      {/* Search */}
      <div className="card mb-4 py-3 px-4 flex items-center gap-3">
        <Shield size={16} className="text-gray-400" />
        <input
          type="text"
          placeholder="Search by user, action, entity..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 outline-none text-sm text-gray-700 placeholder-gray-400"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 text-xs">
            Clear
          </button>
        )}
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">
              {filtered.length} log{filtered.length !== 1 ? 's' : ''}
              {search ? ` matching "${search}"` : ''}
            </h2>
          </div>

          {filtered.length === 0
            ? <EmptyState icon={Shield} title="No logs found" />
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="pb-3 pr-4 font-medium">Time</th>
                      <th className="pb-3 pr-4 font-medium">User</th>
                      <th className="pb-3 pr-4 font-medium">Action</th>
                      <th className="pb-3 pr-4 font-medium">Entity</th>
                      <th className="pb-3 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 200).map((log, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-3 pr-4 text-gray-400 text-xs whitespace-nowrap">
                          {log.timestamp ? format(new Date(log.timestamp), 'MMM d, HH:mm') : '—'}
                        </td>
                        <td className="py-3 pr-4 font-medium text-gray-700">{log.userName || '—'}</td>
                        <td className="py-3 pr-4">
                          <Badge color={ACTION_COLORS[log.action] || 'gray'}>{log.action}</Badge>
                        </td>
                        <td className="py-3 pr-4 text-gray-500 text-xs">{log.entityType || '—'}</td>
                        <td className="py-3 text-gray-600 max-w-xs truncate">{log.description || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length > 200 && (
                  <p className="text-center text-xs text-gray-400 pt-4">Showing 200 of {filtered.length} records</p>
                )}
              </div>
            )
          }
        </div>
      )}
    </div>
  )
}

