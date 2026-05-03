import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, ArrowLeft, RefreshCw, CreditCard, CheckCircle } from 'lucide-react'
import { transactionApi, dailyCashApi, creditApi } from '../services/api.js'
import { PageHeader, LoadingSpinner, formatRs, EmptyState, Badge } from '../components/ui.jsx'
import { format, subDays, addDays } from 'date-fns'
import { formatSLShort } from '../utils/timezone.js'

const SHOP_META = {
  CAFE: { label: 'Cafe', color: '#068A4B', bg: 'bg-[#068A4B]' },
  BOOKSHOP: { label: 'Bookshop', color: '#1565C0', bg: 'bg-[#1565C0]' },
  FOODHUT: { label: 'Food Hut', color: '#B65505', bg: 'bg-[#B65505]' },
}

export default function ShopDetailPage() {
  const { shopCode } = useParams()
  const meta = SHOP_META[shopCode?.toUpperCase()] || { label: shopCode, color: '#666', bg: 'bg-gray-500' }
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [summary, setSummary] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [shopCredits, setShopCredits] = useState([])
  const [loading, setLoading] = useState(true)
  const [markingPaid, setMarkingPaid] = useState(null)

  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')

  const load = async () => {
    setLoading(true)
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    try {
      const [s, t, c] = await Promise.allSettled([
        dailyCashApi.getSummary(shopCode, dateStr).then(r => {
          const d = r.data
          return {
            openingBalance: d.openingCash,
            closingBalance: d.closingCash,
            totalExpenses: d.totalExpenses,
            totalCredits: d.totalCredits,
            calculatedSales: d.totalSales,
            profit: d.totalSales != null ? d.totalSales * ({ CAFE: 0.12, BOOKSHOP: 0.15, FOODHUT: 0.20 }[shopCode?.toUpperCase()] || 0.10) : 0,
          }
        }),
        transactionApi.getByDate(shopCode, dateStr),
        creditApi.getByShop(shopCode, dateStr),
      ])
      if (s.status === 'fulfilled') setSummary(s.value)
      if (t.status === 'fulfilled') setTransactions(t.value.data || [])
      if (c.status === 'fulfilled') setShopCredits(c.value.data?.credits || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [shopCode, selectedDate])

  const markCreditPaid = async (id) => {
    setMarkingPaid(id)
    try {
      await creditApi.markPaid(id)
      await load()
    } finally {
      setMarkingPaid(null)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/shops" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft size={20} />
        </Link>
        <PageHeader
          title={meta.label}
          subtitle={`Daily transaction detail — ${format(selectedDate, 'MMMM d, yyyy')}`}
        />
      </div>

      {/* Date Navigator */}
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-2xl p-3 mb-6 max-w-sm">
        <button onClick={() => setSelectedDate(d => subDays(d, 1))}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft size={18} />
        </button>
        <span className="font-semibold text-sm">{format(selectedDate, 'EEE, MMM d, yyyy')}</span>
        <button onClick={() => setSelectedDate(d => addDays(d, 1))} disabled={isToday}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30">
          <ChevronRight size={18} />
        </button>
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          {/* Summary Grid */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              {[
                { lbl: 'Opening', val: summary.openingBalance, c: 'text-gray-700' },
                { lbl: 'Closing', val: summary.closingBalance, c: 'text-gray-700' },
                { lbl: 'Calculated Sales', val: summary.calculatedSales, c: 'text-green-700 font-bold' },
                { lbl: 'Total Expenses', val: summary.totalExpenses, c: 'text-red-600' },
                { lbl: 'Credits', val: summary.totalCredits, c: 'text-orange-600' },
                { lbl: 'Profit', val: summary.profit, c: 'text-blue-700 font-bold' },
              ].map(({ lbl, val, c }) => (
                <div key={lbl} className="card py-4">
                  <p className="text-xs text-gray-500">{lbl}</p>
                  <p className={`text-lg font-semibold mt-1 ${c}`}>{formatRs(val)}</p>
                </div>
              ))}
            </div>
          )}

          {/* Transactions Table */}
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">Transactions ({transactions.length})</h2>
              <button onClick={load} className="text-gray-400 hover:text-gray-600">
                <RefreshCw size={15} />
              </button>
            </div>
            {transactions.length === 0 ? (
              <EmptyState title="No transactions" description="No entries recorded for this date" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="pb-3 pr-4 font-medium">Type</th>
                      <th className="pb-3 pr-4 font-medium">Item / Category</th>
                      <th className="pb-3 pr-4 font-medium text-right">Amount</th>
                      <th className="pb-3 pr-4 font-medium">Comment</th>
                      <th className="pb-3 pr-4 font-medium">Time (SLT)</th>
                      <th className="pb-3 font-medium">Entered By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t) => (
                      <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-3 pr-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            t.category === 'SALE'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-600'
                          }`}>
                            {t.category}
                          </span>
                        </td>
                        <td className="py-3 pr-4 font-medium text-gray-700">
                          {t.itemName || t.item || t.expenseTypeName || '—'}
                        </td>
                        <td className="py-3 pr-4 text-right font-semibold">
                          {formatRs(t.amount)}
                        </td>
                        <td className="py-3 pr-4 text-gray-500 max-w-[140px] truncate">
                          {t.comment || '—'}
                        </td>
                        <td className="py-3 pr-4 text-gray-400 text-xs whitespace-nowrap">
                          {formatSLShort(t.transactionTime || t.createdAt)}
                        </td>
                        <td className="py-3 text-gray-600 text-xs font-medium">
                          {t.recordedByName || t.recordedBy || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Credits Section */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <CreditCard size={16} className="text-orange-500" />
                Credits ({shopCredits.length})
                {shopCredits.some(c => !c.isPaid) && (
                  <span className="text-xs font-normal text-red-500 ml-1">
                    — {formatRs(shopCredits.filter(c => !c.isPaid).reduce((s, c) => s + (c.amount || 0), 0))} unpaid
                  </span>
                )}
              </h2>
            </div>
            {shopCredits.length === 0 ? (
              <EmptyState icon={CreditCard} title="No credits" description="No credit entries for this date" />
            ) : (
              <div className="space-y-3">
                {shopCredits.map((c) => (
                  <div key={c.id} className={`flex items-start gap-4 p-3 rounded-xl border ${
                    c.isPaid ? 'bg-gray-50 border-gray-100 opacity-70' : 'bg-orange-50 border-orange-100'
                  }`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-800 text-sm">{c.userName || 'Unknown'}</span>
                        {c.isPaid
                          ? <Badge color="green">✓ Paid</Badge>
                          : <Badge color="red">Unpaid</Badge>
                        }
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{c.reason || 'No reason provided'}</p>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <p className={`text-base font-bold ${c.isPaid ? 'text-gray-400 line-through' : 'text-orange-700'}`}>
                        {formatRs(c.amount)}
                      </p>
                      {!c.isPaid && (
                        <button
                          onClick={() => markCreditPaid(c.id)}
                          disabled={markingPaid === c.id}
                          className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium"
                        >
                          <CheckCircle size={13} />
                          {markingPaid === c.id ? 'Saving...' : 'Mark Paid'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

