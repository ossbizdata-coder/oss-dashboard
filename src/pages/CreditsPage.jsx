import { useEffect, useState } from 'react'
import { creditApi } from '../services/api.js'
import { PageHeader, LoadingSpinner, formatRs, Badge } from '../components/ui.jsx'
import { CreditCard, CheckCircle, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'

export default function CreditsPage() {
  const [credits, setCredits] = useState([])
  const [unpaidTotal, setUnpaidTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [shopFilter, setShopFilter] = useState('all')
  const [userFilter, setUserFilter] = useState('all')
  const [paying, setPaying] = useState(null)

  const load = async () => {
    setLoading(true)
    const [c, u] = await Promise.allSettled([creditApi.getAll(), creditApi.getUnpaidTotal()])
    if (c.status === 'fulfilled') setCredits(c.value.data || [])
    if (u.status === 'fulfilled') setUnpaidTotal(u.value.data?.totalAmount || 0)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const markPaid = async (id) => {
    setPaying(id)
    await creditApi.markPaid(id)
    await load()
    setPaying(null)
  }

  const filtered = credits
    .filter(c => filter === 'all' ? true : filter === 'unpaid' ? !c.isPaid : c.isPaid)
    .filter(c => shopFilter === 'all' ? true : (c.department || 'COMMON') === shopFilter)
    .filter(c => userFilter === 'all' ? true : c.userName === userFilter)

  const uniqueUsers = [...new Set(credits.map(c => c.userName).filter(Boolean))].sort()

  const filteredTotal = filtered.reduce((sum, c) => sum + (c.amount || 0), 0)
  const isFiltered = filter !== 'all' || shopFilter !== 'all' || userFilter !== 'all'

  const shopColor = (dept) => {
    if (dept === 'CAFE') return 'green'
    if (dept === 'BOOKSHOP') return 'blue'
    return 'orange'
  }

  return (
    <div>
      <PageHeader
        title="Credits Management"
        subtitle="Track customer IOUs and unpaid balances"
        action={
          <button onClick={load} className="btn-outline flex items-center gap-2 text-sm">
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-red-600">{formatRs(unpaidTotal)}</p>
          <p className="text-sm text-gray-500 mt-1">Total Unpaid</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-gray-700">{credits.filter(c => !c.isPaid).length}</p>
          <p className="text-sm text-gray-500 mt-1">Open Credits</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-green-600">{credits.filter(c => c.isPaid).length}</p>
          <p className="text-sm text-gray-500 mt-1">Paid Credits</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-primary-700">{credits.length}</p>
          <p className="text-sm text-gray-500 mt-1">Total Records</p>
        </div>
      </div>

      {/* Filter */}
      <div className="space-y-2 mb-4">
        {/* Status filter */}
        <div className="flex gap-2">
          {['all', 'unpaid', 'paid'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${
                filter === f ? 'bg-primary-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        {/* Shop filter + Customer dropdown on same row */}
        <div className="flex gap-2 flex-wrap items-center">
          {[['all','All Shops'],['CAFE','Cafe'],['BOOKSHOP','Bookshop'],['FOODHUT','Food Hut'],['COMMON','Common']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setShopFilter(val)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                shopFilter === val ? 'bg-amber-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
          <div className="w-px h-5 bg-gray-200 mx-1" />
          <select
            value={userFilter}
            onChange={e => setUserFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            <option value="all">All Customers</option>
            {uniqueUsers.map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
          {isFiltered && (
            <span className="ml-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-600 text-white">
              {formatRs(filteredTotal)}
            </span>
          )}
        </div>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="card">
          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <CreditCard size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">
                {credits.length === 0
                  ? 'No credits found in the system'
                  : `No ${filter === 'unpaid' ? 'unpaid' : filter === 'paid' ? 'paid' : ''} credits`}
              </p>
              {credits.length > 0 && filter !== 'all' && (
                <button onClick={() => setFilter('all')}
                  className="mt-3 text-sm text-primary-600 hover:underline">
                  Show all {credits.length} credits
                </button>
              )}
            </div>
          ) : (
              <div className="space-y-3">
                {filtered.map((c) => (
                  <div key={c.id} className={`flex items-start gap-4 p-4 rounded-xl border ${
                    c.isPaid ? 'bg-gray-50 border-gray-100 opacity-70' : 'bg-white border-gray-200'
                  }`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-800">{c.userName || 'Unknown'}</span>
                        <Badge color={shopColor(c.department)}>{c.department}</Badge>
                        {c.isPaid
                          ? <Badge color="green">✓ Paid</Badge>
                          : <Badge color="red">Unpaid</Badge>
                        }
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{c.reason || 'No reason provided'}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {c.transactionDate ? `Date: ${c.transactionDate}` : ''}
                        {c.createdAt ? ` · Added ${format(new Date(c.createdAt), 'MMM d, yyyy')}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-lg font-bold ${c.isPaid ? 'text-gray-400 line-through' : 'text-red-600'}`}>
                        {formatRs(c.amount)}
                      </p>
                      {!c.isPaid && (
                        <button
                          onClick={() => markPaid(c.id)}
                          disabled={paying === c.id}
                          className="mt-2 flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium"
                        >
                          <CheckCircle size={14} />
                          {paying === c.id ? 'Marking...' : 'Mark Paid'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      )}
    </div>
  )
}
