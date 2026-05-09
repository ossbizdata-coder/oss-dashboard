import { useEffect, useState } from 'react'
import { foodhutApi } from '../services/api.js'
import { PageHeader, LoadingSpinner, EmptyState } from '../components/ui.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { ChevronLeft, ChevronRight, UtensilsCrossed, Pencil, Trash2, Check, X } from 'lucide-react'
import { format, subDays, addDays } from 'date-fns'

export default function FoodHutPage() {
  const { isSuperAdmin } = useAuth()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [summary, setSummary] = useState(null)
  const [sales, setSales] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  // edit / delete state
  const [editRow, setEditRow] = useState(null)       // { saleId, qty, actionType }
  const [editQty, setEditQty] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null) // saleId
  const [deleting, setDeleting] = useState(null)

  const dateStr = format(selectedDate, 'yyyy-MM-dd')
  const isToday = dateStr === format(new Date(), 'yyyy-MM-dd')

  const load = async () => {
    setLoading(true)
    const [s, sl, it] = await Promise.allSettled([
      foodhutApi.getSummary(dateStr),
      foodhutApi.getSalesForDay(dateStr),
      foodhutApi.getItems(),
    ])
    if (s.status === 'fulfilled') setSummary(s.value.data)
    if (sl.status === 'fulfilled') setSales(sl.value.data || [])
    if (it.status === 'fulfilled') setItems(it.value.data || [])
    setLoading(false)
  }

  useEffect(() => {
    setEditRow(null)
    setDeleteConfirm(null)
    load()
  }, [selectedDate])

  const prepared  = sales.filter(s => s.actionType === 'PREPARED')
  const remaining = sales.filter(s => s.actionType === 'REMAINING')

  const preparedTotal  = prepared.reduce((sum, s)  => sum + ((s.preparedQty  || 0) * (s.price || 0)), 0)
  const remainingTotal = remaining.reduce((sum, s) => sum + ((s.remainingQty || 0) * (s.price || 0)), 0)
  const soldTotal = preparedTotal - remainingTotal

  // ─── Edit helpers ───────────────────────────────────────────────────────────
  const startEdit = (sale) => {
    const qty = sale.actionType === 'PREPARED' ? sale.preparedQty : sale.remainingQty
    setEditRow({ saleId: sale.saleId, actionType: sale.actionType })
    setEditQty(String(qty))
    setDeleteConfirm(null)
  }

  const cancelEdit = () => { setEditRow(null); setEditQty('') }

  const saveEdit = async () => {
    if (!editRow) return
    setSaving(true)
    try {
      const qty = parseInt(editQty, 10) || 0
      const payload = {
        actionType: editRow.actionType,
        preparedQty:  editRow.actionType === 'PREPARED'  ? qty : 0,
        remainingQty: editRow.actionType === 'REMAINING' ? qty : 0,
      }
      await foodhutApi.updateSale(editRow.saleId, payload)
      setEditRow(null)
      await load()
    } catch (e) {
      alert('Failed to save: ' + (e.response?.data?.message || e.message))
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async (saleId) => {
    setDeleting(saleId)
    try {
      await foodhutApi.deleteSale(saleId)
      setDeleteConfirm(null)
      await load()
    } catch (e) {
      alert('Failed to delete: ' + (e.response?.data?.message || e.message))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div>
      <PageHeader title="Food Hut" subtitle="Daily kitchen operations — prepared, sold, remaining" />

      {/* Date navigator */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-2xl p-2">
          <button onClick={() => setSelectedDate(d => subDays(d, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft size={16} />
          </button>
          <span className="px-3 text-sm font-semibold">{format(selectedDate, 'EEE, MMM d, yyyy')}</span>
          <button onClick={() => setSelectedDate(d => addDays(d, 1))} disabled={isToday}
            className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-30">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="card text-center border-l-4 border-[#21C36F]">
          <p className="text-xs text-gray-500 font-medium">PREPARED</p>
          <p className="text-2xl font-bold text-[#21C36F] mt-1">Rs {preparedTotal.toLocaleString()}</p>
          <p className="text-xs text-gray-400">{prepared.length} rows</p>
        </div>
        <div className="card text-center border-l-4 border-blue-500">
          <p className="text-xs text-gray-500 font-medium">SOLD</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">Rs {soldTotal.toLocaleString()}</p>
          <p className="text-xs text-gray-400">Prepared − Remaining</p>
        </div>
        <div className="card text-center border-l-4 border-orange-500">
          <p className="text-xs text-gray-500 font-medium">REMAINING</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">Rs {remainingTotal.toLocaleString()}</p>
          <p className="text-xs text-gray-400">{remaining.length} rows</p>
        </div>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Prepared Items */}
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-4">🍳 Prepared Items ({prepared.length})</h2>
            {prepared.length === 0
              ? <EmptyState icon={UtensilsCrossed} title="No prepared items" />
              : prepared.map((s) => (
                  <SaleRow
                    key={s.saleId}
                    sale={s}
                    qty={s.preparedQty}
                    color="text-[#21C36F]"
                    isSuperAdmin={isSuperAdmin}
                    isEditing={editRow?.saleId === s.saleId}
                    editQty={editQty}
                    saving={saving}
                    deleteConfirm={deleteConfirm}
                    deleting={deleting}
                    onEdit={() => startEdit(s)}
                    onCancel={cancelEdit}
                    onSave={saveEdit}
                    onQtyChange={setEditQty}
                    onDeleteRequest={() => { setDeleteConfirm(s.saleId); setEditRow(null) }}
                    onDeleteConfirm={() => confirmDelete(s.saleId)}
                    onDeleteCancel={() => setDeleteConfirm(null)}
                  />
                ))
            }
          </div>

          {/* Remaining Items */}
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-4">📦 Remaining Items ({remaining.length})</h2>
            {remaining.length === 0
              ? <EmptyState icon={UtensilsCrossed} title="No remaining items" />
              : remaining.map((s) => (
                  <SaleRow
                    key={s.saleId}
                    sale={s}
                    qty={s.remainingQty}
                    color="text-orange-500"
                    isSuperAdmin={isSuperAdmin}
                    isEditing={editRow?.saleId === s.saleId}
                    editQty={editQty}
                    saving={saving}
                    deleteConfirm={deleteConfirm}
                    deleting={deleting}
                    onEdit={() => startEdit(s)}
                    onCancel={cancelEdit}
                    onSave={saveEdit}
                    onQtyChange={setEditQty}
                    onDeleteRequest={() => { setDeleteConfirm(s.saleId); setEditRow(null) }}
                    onDeleteConfirm={() => confirmDelete(s.saleId)}
                    onDeleteCancel={() => setDeleteConfirm(null)}
                  />
                ))
            }
          </div>

          {/* Menu Items */}
          <div className="card lg:col-span-2">
            <h2 className="font-semibold text-gray-800 mb-4">🍽️ Menu Items ({items.length})</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {items.map((item) => (
                <div key={item.id} className="bg-gray-50 rounded-xl p-3">
                  <p className="font-medium text-sm text-gray-800">{item.name}</p>
                  {item.variations?.map((v, vi) => (
                    <p key={vi} className="text-xs text-gray-500 mt-0.5">
                      {v.variation} — Rs {v.price}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SaleRow({
  sale, qty, color, isSuperAdmin,
  isEditing, editQty, saving, deleteConfirm, deleting,
  onEdit, onCancel, onSave, onQtyChange,
  onDeleteRequest, onDeleteConfirm, onDeleteCancel,
}) {
  const isDeletePending = deleteConfirm === sale.saleId
  const isDeleting = deleting === sale.saleId

  return (
    <div className="group border-b border-gray-50 last:border-0 py-2">
      <div className="flex items-center justify-between gap-2">
        {/* Item info */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-700 truncate">{sale.itemName}</p>
          <p className="text-xs text-gray-400">{sale.variation}</p>
        </div>

        {/* Qty — normal or edit input */}
        {isEditing ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              value={editQty}
              onChange={e => onQtyChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel() }}
              className="w-16 border border-blue-300 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-300"
              autoFocus
            />
            <button onClick={onSave} disabled={saving}
              className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50">
              <Check size={13} />
            </button>
            <button onClick={onCancel}
              className="p-1.5 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors">
              <X size={13} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <div className="text-right">
              <p className={`text-sm font-bold ${color}`}>{qty ?? 0}×</p>
              <p className="text-xs text-gray-400">Rs {sale.price}</p>
            </div>
            {/* Edit / Delete icons — SuperAdmin only, visible on hover */}
            {isSuperAdmin && (
              <>
                <button onClick={onEdit}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-blue-50 text-blue-400 hover:text-blue-600 rounded-lg transition-all ml-1">
                  <Pencil size={13} />
                </button>
                <button onClick={onDeleteRequest}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 text-red-400 hover:text-red-600 rounded-lg transition-all">
                  <Trash2 size={13} />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation inline */}
      {isDeletePending && (
        <div className="mt-1 flex items-center gap-2 text-xs bg-red-50 rounded-lg px-3 py-1.5">
          <span className="text-red-600 font-medium flex-1">Delete this entry?</span>
          <button onClick={onDeleteConfirm} disabled={isDeleting}
            className="px-2 py-0.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors disabled:opacity-50">
            {isDeleting ? '…' : 'Delete'}
          </button>
          <button onClick={onDeleteCancel}
            className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded-md hover:bg-gray-300 transition-colors">
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
