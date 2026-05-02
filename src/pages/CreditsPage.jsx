import { useEffect, useState } from 'react'
import { creditApi } from '../services/api.js'
import { PageHeader, LoadingSpinner, EmptyState, formatRs, Badge } from '../components/ui.jsx'
import { CreditCard, CheckCircle, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'

export default function CreditsPage() {
  const [credits, setCredits] = useState([])
  const [unpaidTotal, setUnpaidTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [paying, setPaying] = useState(null)

  const load = async () => {
    setLoading(true)
    const [c, u] = await Promise.allSettled([creditApi.getAll(), creditApi.getUnpaidTotal()])
    if (c.status === 'fulfilled') setCredits(c.value.data || [])
    if (u.status === 'fulfilled') setUnpaidTotal(u.value.data?.total || 0)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const markPaid = async (id) => {
    setPaying(id)
    await creditApi.markPaid(id)
    await load()
    setPaying(null)
  }

  const filtered = filter === 'all' ? credits
    : filter === 'unpaid' ? credits.filter(c => !c.isPaid)
    : credits.filter(c => c.isPaid)

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
      <div className="flex gap-2 mb-4">
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

      {loading ? <LoadingSpinner /> : (
        <div className="card">
          {filtered.length === 0
            ? <EmptyState icon={CreditCard} title="No credits found" />
            : (
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
                        {c.createdAt ? format(new Date(c.createdAt), 'MMM d, yyyy HH:mm') : ''}
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

