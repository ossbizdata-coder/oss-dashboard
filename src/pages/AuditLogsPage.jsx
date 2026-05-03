import { useEffect, useState, useMemo } from 'react'
import { auditApi } from '../services/api.js'
import { PageHeader, LoadingSpinner, EmptyState, Badge } from '../components/ui.jsx'
import { Shield, RefreshCw, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatSLShort } from '../utils/timezone.js'
import { format, subDays, addDays } from 'date-fns'

const ACTION_COLORS = {
  LOGIN:  'blue',
  LOGOUT: 'gray',
  CREATE: 'green',
  UPDATE: 'yellow',
  DELETE: 'red',
}

const ENTITY_ICONS = {
  TRANSACTION: '💰',
  CREDIT:      '💳',
  DAILY_CASH:  '🏦',
  USER:        '👤',
  EXPENSE:     '📋',
  ATTENDANCE:  '📅',
}

const PAGE_SIZE = 50

// Returns today's date string in yyyy-MM-dd (local machine date)
const todayStr = () => format(new Date(), 'yyyy-MM-dd')

export default function AuditLogsPage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [logs, setLogs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [filterAction, setFilterAction] = useState('ALL')
  const [filterEntity, setFilterEntity] = useState('ALL')
  const [page, setPage]         = useState(1)
  const [expanded, setExpanded] = useState(null)
  const [error, setError] = useState(null)

  const dateStr = format(selectedDate, 'yyyy-MM-dd')
  const isToday = dateStr === todayStr()

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await auditApi.getByDate(dateStr)
      setLogs(res.data || [])
    } catch (err) {
      console.error('Audit logs fetch error:', err?.response?.status, err?.response?.data || err?.message)
      setError(`Error ${err?.response?.status || ''}: ${err?.response?.data?.message || err?.message || 'Failed to load logs'}`)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [dateStr])
  useEffect(() => { setPage(1) }, [search, filterAction, filterEntity, dateStr])

  const actionTypes = useMemo(() => {
    const set = new Set(logs.map(l => l.action).filter(Boolean))
    return ['ALL', ...Array.from(set).sort()]
  }, [logs])

  const entityTypes = useMemo(() => {
    const set = new Set(logs.map(l => l.entityType).filter(Boolean))
    return ['ALL', ...Array.from(set).sort()]
  }, [logs])

  const filtered = useMemo(() => logs.filter(l => {
    if (filterAction !== 'ALL' && l.action !== filterAction) return false
    if (filterEntity !== 'ALL' && l.entityType !== filterEntity) return false
    if (search) {
      const q = search.toLowerCase()
      return [l.userName, l.action, l.entityType, l.description, l.userEmail]
        .some(v => v?.toLowerCase().includes(q))
    }
    return true
  }), [logs, search, filterAction, filterEntity])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const toggleExpand = (id) => setExpanded(prev => prev === id ? null : id)

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        subtitle="Full system activity trail — all times in Sri Lanka Time (SLT, UTC+5:30)"
        action={
          <button onClick={load} className="btn-outline flex items-center gap-2 text-sm">
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />

      {/* Date Switcher */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center bg-white border border-gray-200 rounded-2xl px-2 py-1.5 gap-1">
          <button onClick={() => setSelectedDate(d => subDays(d, 1))}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft size={16} />
          </button>
          <input
            type="date"
            value={dateStr}
            max={todayStr()}
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
        <span className="text-xs text-gray-400 ml-1">
          {format(selectedDate, 'EEEE, MMMM d, yyyy')}
        </span>
      </div>

      {/* Filters */}
      <div className="card mb-4 py-3 px-4 flex flex-wrap items-center gap-3">
        <Shield size={16} className="text-gray-400 shrink-0" />
        <input
          type="text"
          placeholder="Search user, description, entity..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[180px] outline-none text-sm text-gray-700 placeholder-gray-400"
        />
        <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none text-gray-700 bg-white">
          {actionTypes.map(a => <option key={a} value={a}>{a === 'ALL' ? 'All Actions' : a}</option>)}
        </select>
        <select value={filterEntity} onChange={e => setFilterEntity(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none text-gray-700 bg-white">
          {entityTypes.map(e => <option key={e} value={e}>{e === 'ALL' ? 'All Entities' : e}</option>)}
        </select>
        {(search || filterAction !== 'ALL' || filterEntity !== 'ALL') && (
          <button onClick={() => { setSearch(''); setFilterAction('ALL'); setFilterEntity('ALL') }}
            className="text-xs text-gray-400 hover:text-gray-600 whitespace-nowrap">
            Clear
          </button>
        )}
      </div>

      {loading ? <LoadingSpinner /> : error ? (
        <div className="card border-red-200 bg-red-50 text-red-700 py-6 text-center text-sm">
          <p className="font-semibold mb-1">⚠️ Could not load audit logs</p>
          <p className="text-xs opacity-75">{error}</p>
        </div>
      ) : (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">
              {filtered.length.toLocaleString()} log{filtered.length !== 1 ? 's' : ''}
              <span className="text-xs font-normal text-gray-400 ml-2">on {format(selectedDate, 'MMM d')}</span>
            </h2>
            {totalPages > 1 && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-2 py-1 border rounded disabled:opacity-30 hover:bg-gray-50">‹</button>
                <span>{page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-2 py-1 border rounded disabled:opacity-30 hover:bg-gray-50">›</button>
              </div>
            )}
          </div>

          {filtered.length === 0
            ? <EmptyState icon={Shield} title="No logs for this day" description="Try a different date or adjust filters" />
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="pb-3 pr-4 font-medium whitespace-nowrap">Time (SLT)</th>
                      <th className="pb-3 pr-4 font-medium">User</th>
                      <th className="pb-3 pr-4 font-medium">Action</th>
                      <th className="pb-3 pr-4 font-medium">Entity</th>
                      <th className="pb-3 font-medium">Description</th>
                      <th className="pb-3 pl-2 w-6"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((log) => (
                      <>
                        <tr key={log.id}
                          className={`border-b border-gray-50 transition-colors ${(log.oldValue || log.newValue) ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                          onClick={() => (log.oldValue || log.newValue) && toggleExpand(log.id)}
                        >
                          <td className="py-3 pr-4 text-gray-400 text-xs whitespace-nowrap">
                            {formatSLShort(log.createdAt)}
                          </td>
                          <td className="py-3 pr-4">
                            <div className="font-medium text-gray-700">{log.userName || '—'}</div>
                            {log.userEmail && <div className="text-xs text-gray-400">{log.userEmail}</div>}
                          </td>
                          <td className="py-3 pr-4">
                            <Badge color={ACTION_COLORS[log.action] || 'gray'}>{log.action}</Badge>
                          </td>
                          <td className="py-3 pr-4 text-gray-500 text-xs whitespace-nowrap">
                            {ENTITY_ICONS[log.entityType] || '📄'} {log.entityType || '—'}
                            {log.entityId && <span className="text-gray-400 ml-1">#{log.entityId}</span>}
                          </td>
                          <td className="py-3 text-gray-600 max-w-xs truncate">
                            {log.description || '—'}
                          </td>
                          <td className="py-3 pl-2 text-gray-300">
                            {(log.oldValue || log.newValue) && (
                              expanded === log.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                            )}
                          </td>
                        </tr>

                        {expanded === log.id && (
                          <tr key={`${log.id}-detail`} className="bg-gray-50">
                            <td colSpan={6} className="px-4 py-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                                {log.oldValue && (
                                  <div>
                                    <p className="text-red-500 font-semibold mb-1 font-sans">Before</p>
                                    <pre className="bg-red-50 border border-red-100 rounded p-3 overflow-auto max-h-40 text-red-800 whitespace-pre-wrap">
                                      {JSON.stringify(log.oldValue, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {log.newValue && (
                                  <div>
                                    <p className="text-green-600 font-semibold mb-1 font-sans">After</p>
                                    <pre className="bg-green-50 border border-green-100 rounded p-3 overflow-auto max-h-40 text-green-800 whitespace-pre-wrap">
                                      {JSON.stringify(log.newValue, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 pt-4 text-sm text-gray-500 border-t border-gray-100 mt-4">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      className="px-3 py-1.5 border rounded-lg disabled:opacity-30 hover:bg-gray-50">← Prev</button>
                    <span>Page {page} of {totalPages} · {filtered.length} total</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="px-3 py-1.5 border rounded-lg disabled:opacity-30 hover:bg-gray-50">Next →</button>
                  </div>
                )}
              </div>
            )
          }
        </div>
      )}
    </div>
  )
}

