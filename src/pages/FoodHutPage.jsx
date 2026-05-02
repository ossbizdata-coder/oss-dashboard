import { useEffect, useState } from 'react'
import { foodhutApi } from '../services/api.js'
import { PageHeader, LoadingSpinner, EmptyState } from '../components/ui.jsx'
import { ChevronLeft, ChevronRight, UtensilsCrossed } from 'lucide-react'
import { format, subDays, addDays } from 'date-fns'

export default function FoodHutPage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [summary, setSummary] = useState(null)
  const [sales, setSales] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

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

  useEffect(() => { load() }, [selectedDate])

  const prepared = sales.filter(s => s.actionType === 'PREPARED')
  const remaining = sales.filter(s => s.actionType === 'REMAINING')

  const preparedTotal = prepared.reduce((sum, s) => sum + (s.quantity * s.price), 0)
  const remainingTotal = remaining.reduce((sum, s) => sum + (s.quantity * s.price), 0)
  const soldTotal = preparedTotal - remainingTotal

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
          <p className="text-xs text-gray-400">{summary?.totalPreparedQty ?? 0} items</p>
        </div>
        <div className="card text-center border-l-4 border-blue-500">
          <p className="text-xs text-gray-500 font-medium">SOLD</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">Rs {soldTotal.toLocaleString()}</p>
          <p className="text-xs text-gray-400">{summary?.totalSoldQty ?? 0} items</p>
        </div>
        <div className="card text-center border-l-4 border-orange-500">
          <p className="text-xs text-gray-500 font-medium">REMAINING</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">Rs {remainingTotal.toLocaleString()}</p>
          <p className="text-xs text-gray-400">{summary?.totalRemainingQty ?? 0} items</p>
        </div>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Prepared Items */}
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-4">
              🍳 Prepared Items ({prepared.length})
            </h2>
            {prepared.length === 0
              ? <EmptyState icon={UtensilsCrossed} title="No prepared items" />
              : prepared.map((s, i) => <SaleRow key={i} sale={s} color="text-[#21C36F]" />)
            }
          </div>

          {/* Remaining Items */}
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-4">
              📦 Remaining Items ({remaining.length})
            </h2>
            {remaining.length === 0
              ? <EmptyState icon={UtensilsCrossed} title="No remaining items" />
              : remaining.map((s, i) => <SaleRow key={i} sale={s} color="text-orange-500" />)
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

function SaleRow({ sale, color }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-700">{sale.itemName}</p>
        <p className="text-xs text-gray-400">{sale.variation}</p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-bold ${color}`}>{sale.quantity}×</p>
        <p className="text-xs text-gray-400">Rs {sale.price}</p>
      </div>
    </div>
  )
}

