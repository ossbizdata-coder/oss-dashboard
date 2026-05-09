import { useEffect, useState } from 'react'
import { dailyCashApi, expenseTypeApi, adminTransactionApi } from '../services/api.js'
import { PageHeader, LoadingSpinner, formatRs } from '../components/ui.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { ChevronLeft, ChevronRight, Pencil, Trash2, X, Check, Receipt, RefreshCw } from 'lucide-react'
import { format, subDays, addDays } from 'date-fns'
import { formatSLShort } from '../utils/timezone.js'

const SHOPS = [
  { code: 'CAFE',     label: 'Cafe',      color: 'border-[#068A4B]', textColor: 'text-[#068A4B]', lightBg: 'bg-green-50' },
  { code: 'BOOKSHOP', label: 'Bookshop',  color: 'border-[#1565C0]', textColor: 'text-[#1565C0]', lightBg: 'bg-blue-50' },
  { code: 'FOODHUT',  label: 'Food Hut',  color: 'border-[#B65505]', textColor: 'text-[#B65505]', lightBg: 'bg-orange-50' },
]

export default function ExpensesPage() {
  const { isSuperAdmin } = useAuth()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [shopData, setShopData]   = useState({}) // code → { expenses, totalExpenses, locked, dailyCashId }
  const [expenseTypes, setExpenseTypes] = useState([])
  const [loading, setLoading]     = useState(true)
  const [editItem, setEditItem]   = useState(null)   // { ...expense, shopCode }
  const [saving, setSaving]       = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null) // id
  const [deleting, setDeleting]   = useState(null)

  const dateStr = format(selectedDate, 'yyyy-MM-dd')
  const isToday = dateStr === format(new Date(), 'yyyy-MM-dd')

  const load = async () => {
    setLoading(true)
    const [types, ...shopResults] = await Promise.allSettled([
      expenseTypeApi.getAll(),
      ...SHOPS.map(s => dailyCashApi.getSummary(s.code, dateStr)),
    ])
    if (types.status === 'fulfilled') setExpenseTypes(types.value.data || [])
    const map = {}
    shopResults.forEach((r, i) => {
      const code = SHOPS[i].code
      if (r.status === 'fulfilled') {
        const d = r.value.data
        map[code] = {
          dailyCashId:   d.dailyCashId,
          locked:        d.locked,
          totalExpenses: d.totalExpenses || 0,
          expenses:      d.expenses || [],
        }
      } else {
        map[code] = { dailyCashId: null, locked: false, totalExpenses: 0, expenses: [] }
      }
    })
    setShopData(map)
    setLoading(false)
  }

  useEffect(() => { load() }, [dateStr])

  const grandTotal = SHOPS.reduce((sum, s) => sum + (shopData[s.code]?.totalExpenses || 0), 0)

  // ── Edit ─────────────────────────────────────────────────────────────────────
  const openEdit = (expense, shopCode) => setEditItem({
    id:            expense.id,
    amount:        expense.amount,
    description:   expense.description || '',
    expenseTypeId: expense.expenseTypeId,
    shopCode,
  })
  const closeEdit = () => setEditItem(null)

  const saveEdit = async () => {
    if (!editItem) return
    setSaving(true)
    try {
      await adminTransactionApi.update(editItem.id, {
        amount:        parseFloat(editItem.amount),
        description:   editItem.description,
        expenseTypeId: editItem.expenseTypeId,
      })
      closeEdit()
      await load()
    } catch (e) {
      alert('Failed to save: ' + (e?.response?.data?.error || e.message))
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────────
  const doDelete = async (id) => {
    setDeleting(id)
    try {
      await adminTransactionApi.delete(id)
      setDeleteConfirm(null)
      await load()
    } catch (e) {
      alert('Failed to delete: ' + (e?.response?.data?.error || e.message))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Daily expenses across all shops"
        action={
          <button onClick={load} className="btn-outline flex items-center gap-2 text-sm">
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />

      {/* Date Navigator */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center bg-white border border-gray-200 rounded-2xl px-2 py-1.5 gap-1 shadow-sm">
          <button onClick={() => setSelectedDate(d => subDays(d, 1))}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft size={16} />
          </button>
          <input
            type="date"
            value={dateStr}
            max={format(new Date(), 'yyyy-MM-dd')}
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
        <span className="text-xs text-gray-400">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</span>
        {!loading && (
          <span className="ml-auto font-bold text-red-600 text-sm bg-red-50 px-3 py-1.5 rounded-xl">
            Total: {formatRs(grandTotal)}
          </span>
        )}
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {SHOPS.map(({ code, label, color, textColor, lightBg }) => {
            const shop = shopData[code] || { expenses: [], totalExpenses: 0 }
            const expenses = shop.expenses

            return (
              <div key={code} className={`card border-l-4 ${color}`}>
                {/* Shop header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className={`font-bold text-base ${textColor}`}>{label}</h2>
                    {shop.locked && (
                      <span className="text-[10px] text-orange-500 font-medium">LOCKED</span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-red-600">{formatRs(shop.totalExpenses)}</span>
                </div>

                {expenses.length === 0 ? (
                  <div className="text-center py-6 text-gray-400">
                    <Receipt size={28} className="mx-auto mb-2 opacity-40" />
                    <p className="text-xs">No expenses recorded</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {expenses.map(exp => (
                      <div key={exp.id}
                        className={`${lightBg} rounded-xl px-3 py-2 flex items-start gap-2 group`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-gray-700">
                              {exp.expenseTypeName || 'Expense'}
                            </span>
                            {exp.description && (
                              <span className="text-xs text-gray-500 truncate max-w-[140px]">
                                — {exp.description}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-400">
                              {exp.createdAt ? formatSLShort(exp.createdAt) : ''}
                            </span>
                            {exp.recordedByName && (
                              <span className="text-xs text-gray-400">· {exp.recordedByName}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-sm font-bold text-red-600">{formatRs(exp.amount)}</span>

                          {isSuperAdmin && (
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                              <button
                                onClick={() => openEdit(exp, code)}
                                className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded"
                                title="Edit"
                              >
                                <Pencil size={12} />
                              </button>
                              {deleteConfirm === exp.id ? (
                                <>
                                  <button
                                    onClick={() => doDelete(exp.id)}
                                    disabled={deleting === exp.id}
                                    className="px-1.5 py-0.5 text-[10px] text-white bg-red-500 hover:bg-red-600 rounded disabled:opacity-50"
                                  >
                                    {deleting === exp.id ? '…' : 'Yes'}
                                  </button>
                                  <button onClick={() => setDeleteConfirm(null)}
                                    className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                                    <X size={11} />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => setDeleteConfirm(exp.id)}
                                  className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                                  title="Delete"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Shop subtotal */}
                {expenses.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs text-gray-500">
                    <span>{expenses.length} item{expenses.length !== 1 ? 's' : ''}</span>
                    <span className="font-semibold text-red-600">{formatRs(shop.totalExpenses)}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={closeEdit}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-800">Edit Expense</h2>
              <button onClick={closeEdit} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Expense Type */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Expense Type</label>
                <select
                  value={editItem.expenseTypeId || ''}
                  onChange={e => setEditItem(i => ({ ...i, expenseTypeId: parseInt(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                >
                  <option value="">— Select type —</option>
                  {expenseTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Amount (Rs)</label>
                <input
                  type="number"
                  value={editItem.amount}
                  onChange={e => setEditItem(i => ({ ...i, amount: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                <input
                  type="text"
                  value={editItem.description}
                  onChange={e => setEditItem(i => ({ ...i, description: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  placeholder="Optional note"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={closeEdit}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 bg-primary-700 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-primary-800 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? 'Saving…' : <><Check size={15} /> Save</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

