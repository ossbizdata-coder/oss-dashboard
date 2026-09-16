import { useEffect, useMemo, useState } from 'react'
import { dailyCashApi, expenseTypeApi, adminTransactionApi, reportApi } from '../services/api.js'
import { PageHeader, LoadingSpinner, formatRs, EmptyState } from '../components/ui.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { ChevronLeft, ChevronRight, Pencil, Trash2, X, Check, Receipt, RefreshCw } from 'lucide-react'
import { format, subDays, addDays } from 'date-fns'
import { formatSLShort } from '../utils/timezone.js'
import { sanitizeDisplayText } from '../utils/businessSettings.js'

const SHOPS = [
  { code: 'CAFE', label: 'Cafe', color: 'border-[#068A4B]', textColor: 'text-[#068A4B]', lightBg: 'bg-green-50' },
  { code: 'BOOKSHOP', label: 'Bookshop', color: 'border-[#1565C0]', textColor: 'text-[#1565C0]', lightBg: 'bg-blue-50' },
  { code: 'FOODHUT', label: 'Food Hut', color: 'border-[#B65505]', textColor: 'text-[#B65505]', lightBg: 'bg-orange-50' },
]

export default function ExpensesPage() {
  const { isSuperAdmin } = useAuth()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [shopData, setShopData] = useState({})
  const [expenseTypes, setExpenseTypes] = useState([])
  const [filterExpenseTypeId, setFilterExpenseTypeId] = useState(null)
  const [monthlyExpenseTypeId, setMonthlyExpenseTypeId] = useState(null)
  const [monthlyExpenses, setMonthlyExpenses] = useState([])
  const [loadingDaily, setLoadingDaily] = useState(true)
  const [loadingMonthly, setLoadingMonthly] = useState(true)
  const [editItem, setEditItem] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const dateStr = format(selectedDate, 'yyyy-MM-dd')
  const isToday = dateStr === format(new Date(), 'yyyy-MM-dd')
  const [selectedYear, selectedMonthValue] = selectedMonth.split('-').map(Number)

  const loadExpenseTypes = async () => {
    const response = await expenseTypeApi.getAll()
    setExpenseTypes(response.data || [])
  }

  const loadDaily = async () => {
    setLoadingDaily(true)
    try {
      const results = await Promise.allSettled(SHOPS.map((shop) => dailyCashApi.getSummary(shop.code, dateStr)))
      const map = {}
      results.forEach((result, index) => {
        const code = SHOPS[index].code
        if (result.status === 'fulfilled') {
          const data = result.value.data || {}
          map[code] = {
            dailyCashId: data.dailyCashId,
            locked: data.locked,
            totalExpenses: data.totalExpenses || 0,
            expenses: data.expenses || [],
          }
        } else {
          map[code] = { dailyCashId: null, locked: false, totalExpenses: 0, expenses: [] }
        }
      })
      setShopData(map)
    } finally {
      setLoadingDaily(false)
    }
  }

  const loadMonthly = async () => {
    setLoadingMonthly(true)
    try {
      const response = await reportApi.getMonthlyExpenseItems(selectedYear, selectedMonthValue)
      setMonthlyExpenses(response.data || [])
    } finally {
      setLoadingMonthly(false)
    }
  }

  const refreshAll = async () => {
    await Promise.all([loadExpenseTypes(), loadDaily(), loadMonthly()])
  }

  useEffect(() => {
    loadExpenseTypes()
  }, [])

  useEffect(() => {
    loadDaily()
  }, [dateStr])

  useEffect(() => {
    loadMonthly()
  }, [selectedMonth])

  const filteredShopData = useMemo(() => (
    Object.entries(shopData).reduce((acc, [code, shop]) => {
      const filteredExpenses = filterExpenseTypeId
        ? shop.expenses.filter((expense) => expense.expenseTypeId === filterExpenseTypeId)
        : shop.expenses
      acc[code] = {
        ...shop,
        expenses: filteredExpenses,
        totalExpenses: filteredExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0),
      }
      return acc
    }, {})
  ), [filterExpenseTypeId, shopData])

  const grandTotal = SHOPS.reduce((sum, shop) => sum + (filteredShopData[shop.code]?.totalExpenses || 0), 0)

  const filteredMonthlyExpenses = monthlyExpenseTypeId
    ? monthlyExpenses.filter((expense) => expense.expenseTypeId === monthlyExpenseTypeId)
    : monthlyExpenses

  const monthlyTotal = monthlyExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0)
  const filteredMonthlyTotal = filteredMonthlyExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0)

  const monthlyShopTotals = SHOPS.map((shop) => ({
    ...shop,
    total: filteredMonthlyExpenses
      .filter((expense) => expense.shopCode === shop.code)
      .reduce((sum, expense) => sum + (expense.amount || 0), 0),
  }))

  const openEdit = (expense, shopCode) => setEditItem({
    id: expense.id,
    amount: expense.amount,
    description: expense.description || '',
    expenseTypeId: expense.expenseTypeId,
    shopCode,
  })

  const closeEdit = () => setEditItem(null)

  const saveEdit = async () => {
    if (!editItem) return
    setSaving(true)
    try {
      await adminTransactionApi.update(editItem.id, {
        amount: parseFloat(editItem.amount),
        description: editItem.description,
        expenseTypeId: editItem.expenseTypeId,
      })
      closeEdit()
      await refreshAll()
    } catch (error) {
      alert('Failed to save: ' + (error?.response?.data?.error || error.message))
    } finally {
      setSaving(false)
    }
  }

  const doDelete = async (id) => {
    setDeleting(id)
    try {
      await adminTransactionApi.delete(id)
      setDeleteConfirm(null)
      await refreshAll()
    } catch (error) {
      alert('Failed to delete: ' + (error?.response?.data?.error || error.message))
    } finally {
      setDeleting(null)
    }
  }

  const sortedExpenseTypes = expenseTypes.slice().sort((left, right) =>
    sanitizeDisplayText(left.name, '').localeCompare(sanitizeDisplayText(right.name, ''))
  )

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Monthly and daily expenses across all shops"
        action={(
          <>
            <div className="flex items-center bg-white border border-gray-200 rounded-2xl px-2 py-1.5 gap-1 shadow-sm">
              <button onClick={() => setSelectedDate(d => subDays(d, 1))}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronLeft size={16} />
              </button>
              <input
                type="date"
                value={dateStr}
                max={format(new Date(), 'yyyy-MM-dd')}
                onChange={event => event.target.value && setSelectedDate(new Date(event.target.value + 'T00:00:00'))}
                className="text-sm font-semibold text-gray-700 outline-none bg-transparent cursor-pointer px-1"
              />
              <button onClick={() => setSelectedDate(d => addDays(d, 1))} disabled={isToday}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30">
                <ChevronRight size={16} />
              </button>
            </div>
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="text-sm font-medium bg-white border border-gray-200 rounded-2xl px-3 py-2 text-gray-700 outline-none focus:ring-2 focus:ring-primary-400"
            />
            <button onClick={() => setSelectedDate(new Date())}
              className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-full font-medium transition-colors">
              Today
            </button>
            <button onClick={refreshAll} className="btn-outline flex items-center gap-2 text-sm">
              <RefreshCw size={14} /> Refresh
            </button>
          </>
        )}
      />
      
      <div className="card mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="font-semibold text-gray-800">Monthly Expenses</h2>
            <p className="text-sm text-gray-500 mt-1">Overall expenses for the selected month with expense-type filtering.</p>
          </div>
          <select
            value={monthlyExpenseTypeId || ''}
            onChange={(event) => setMonthlyExpenseTypeId(event.target.value ? parseInt(event.target.value) : null)}
            className="text-sm font-medium bg-white border border-gray-200 rounded-2xl px-3 py-2 text-gray-700 outline-none focus:ring-2 focus:ring-primary-400"
          >
            <option value="">All Expense Types</option>
            {sortedExpenseTypes.map((type) => (
              <option key={type.id} value={type.id}>{sanitizeDisplayText(type.name)}</option>
            ))}
          </select>
        </div>

        {loadingMonthly ? <LoadingSpinner /> : (
          filteredMonthlyExpenses.length === 0 ? (
            <EmptyState icon={Receipt} title="No monthly expenses" description="No expense records were found for the selected month." />
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-5">
                <div className="rounded-2xl bg-red-50 px-4 py-4 border border-red-100 lg:col-span-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-red-600">Total Monthly Expenses</p>
                  <p className="text-2xl font-bold text-red-700 mt-2">{formatRs(monthlyTotal)}</p>
                  {monthlyExpenseTypeId && (
                    <p className="text-xs text-red-500 mt-1">Filtered: {formatRs(filteredMonthlyTotal)}</p>
                  )}
                </div>
                {monthlyShopTotals.map((shop) => (
                  <div key={shop.code} className={`rounded-2xl border px-4 py-4 ${shop.color}`}>
                    <p className={`text-xs font-bold uppercase tracking-wide ${shop.textColor}`}>{shop.label}</p>
                    <p className="text-xl font-bold text-gray-900 mt-2">{formatRs(shop.total)}</p>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h3 className="font-medium text-gray-800 mb-3">Recent Monthly Expense Entries</h3>
                <div className="space-y-2">
                  {filteredMonthlyExpenses.slice(0, 8).map((expense) => (
                    <div key={expense.id} className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 rounded-xl px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {sanitizeDisplayText(expense.expenseTypeName)} · {sanitizeDisplayText(expense.shopName, expense.shopCode || 'Department')}
                        </p>
                        <p className="text-xs text-gray-500">
                          {sanitizeDisplayText(expense.description)} · {expense.businessDate || 'No date'}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-red-600">{formatRs(expense.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )
        )}
      </div>

      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Daily Expenses</h2>
          <p className="text-sm text-gray-500">Expenses for the selected day across all shops.</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <select
          value={filterExpenseTypeId || ''}
          onChange={(event) => setFilterExpenseTypeId(event.target.value ? parseInt(event.target.value) : null)}
          className="text-sm font-medium bg-white border border-gray-200 rounded-2xl px-3 py-1.5 text-gray-700 outline-none hover:border-gray-300 focus:ring-2 focus:ring-primary-400"
        >
          <option value="">All Expense Types</option>
          {sortedExpenseTypes.map((type) => (
            <option key={type.id} value={type.id}>{sanitizeDisplayText(type.name)}</option>
          ))}
        </select>

        {!loadingDaily && (
          <span className="ml-auto font-bold text-red-600 text-sm bg-red-50 px-3 py-1.5 rounded-xl">
            Total: {formatRs(grandTotal)}
          </span>
        )}
      </div>

      {loadingDaily ? <LoadingSpinner /> : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {SHOPS.map(({ code, label, color, textColor, lightBg }) => {
            const shop = filteredShopData[code] || { expenses: [], totalExpenses: 0 }
            const expenses = shop.expenses

            return (
              <div key={code} className={`card border-l-4 ${color}`}>
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
                    {expenses.map((expense) => (
                      <div key={expense.id} className={`${lightBg} rounded-xl px-3 py-2 flex items-start gap-2 group`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-gray-700">
                              {sanitizeDisplayText(expense.expenseTypeName, 'Expense')}
                            </span>
                            {expense.description && (
                              <span className="text-xs text-gray-500 truncate max-w-[140px]">
                                — {sanitizeDisplayText(expense.description)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-400">
                              {expense.createdAt ? formatSLShort(expense.createdAt) : ''}
                            </span>
                            {expense.recordedByName && (
                              <span className="text-xs text-gray-400">· {expense.recordedByName}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-sm font-bold text-red-600">{formatRs(expense.amount)}</span>

                          {isSuperAdmin && (
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                              <button
                                onClick={() => openEdit(expense, code)}
                                className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded"
                                title="Edit"
                              >
                                <Pencil size={12} />
                              </button>
                              {deleteConfirm === expense.id ? (
                                <>
                                  <button
                                    onClick={() => doDelete(expense.id)}
                                    disabled={deleting === expense.id}
                                    className="px-1.5 py-0.5 text-[10px] text-white bg-red-500 hover:bg-red-600 rounded disabled:opacity-50"
                                  >
                                    {deleting === expense.id ? '…' : 'Yes'}
                                  </button>
                                  <button onClick={() => setDeleteConfirm(null)}
                                    className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                                    <X size={11} />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => setDeleteConfirm(expense.id)}
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

      {editItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={closeEdit}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
            onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-800">Edit Expense</h2>
              <button onClick={closeEdit} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Expense Type</label>
                <select
                  value={editItem.expenseTypeId || ''}
                  onChange={(event) => setEditItem((item) => ({ ...item, expenseTypeId: parseInt(event.target.value) }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                >
                  <option value="">— Select type —</option>
                  {sortedExpenseTypes.map((type) => (
                    <option key={type.id} value={type.id}>{sanitizeDisplayText(type.name)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Amount</label>
                <input
                  type="number"
                  value={editItem.amount}
                  onChange={(event) => setEditItem((item) => ({ ...item, amount: event.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                <input
                  type="text"
                  value={editItem.description}
                  onChange={(event) => setEditItem((item) => ({ ...item, description: event.target.value }))}
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
