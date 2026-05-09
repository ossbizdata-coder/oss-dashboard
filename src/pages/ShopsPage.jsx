import { Link } from 'react-router-dom'
import { Coffee, BookOpen, UtensilsCrossed, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { PageHeader, formatRs } from '../components/ui.jsx'
import { useEffect, useState } from 'react'
import { dailyCashApi } from '../services/api.js'
import { format, subDays, addDays } from 'date-fns'

const SHOPS = [
  { code: 'CAFE', label: 'Cafe', icon: Coffee, color: '#068A4B', bg: 'bg-[#068A4B]', lightBg: 'bg-green-50' },
  { code: 'BOOKSHOP', label: 'Bookshop', icon: BookOpen, color: '#1565C0', bg: 'bg-[#1565C0]', lightBg: 'bg-blue-50' },
  { code: 'FOODHUT', label: 'Food Hut', icon: UtensilsCrossed, color: '#B65505', bg: 'bg-[#B65505]', lightBg: 'bg-orange-50' },
]

export default function ShopsPage() {
  const [summaries, setSummaries] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date())

  const dateStr = format(selectedDate, 'yyyy-MM-dd')
  const isToday = dateStr === format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    setLoading(true)
    setSummaries({})
    Promise.allSettled(
      SHOPS.map(s =>
        dailyCashApi.getSummary(s.code, dateStr).then(r => {
          const d = r.data
          return {
            code: s.code,
            data: {
              openingBalance:  d.openingCash,
              closingBalance:  d.closingCash,
              calculatedSales: d.totalSales,
              totalExpenses:   d.totalExpenses,
              totalCredits:    d.totalCredits,
              profit: d.totalSales != null
                ? d.totalSales * ({ CAFE: 0.12, BOOKSHOP: 0.15, FOODHUT: 0.20 }[s.code] || 0.10)
                : 0,
              locked: d.locked,
            }
          }
        })
      )
    ).then(results => {
      const map = {}
      results.forEach(r => { if (r.status === 'fulfilled') map[r.value.code] = r.value.data })
      setSummaries(map)
      setLoading(false)
    })
  }, [dateStr])

  return (
    <div>
      <PageHeader title="Shop Operations" subtitle="Daily performance across all 3 shops" />

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
      </div>

      <div className="grid grid-cols-1 gap-6">
        {SHOPS.map(({ code, label, icon: Icon, bg, lightBg, color }) => {
          const s = summaries[code] || {}
          return (
            <div key={code} className="card">
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-12 h-12 ${bg} rounded-2xl flex items-center justify-center`}>
                  <Icon size={24} className="text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900">{label}</h2>
                  <p className="text-sm text-gray-500">Shop Code: {code}</p>
                </div>
                <Link
                  to={`/shops/${code}`}
                  className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl border"
                  style={{ borderColor: color, color }}
                >
                  View Details <ArrowRight size={14} />
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: 'Opening', value: formatRs(s.openingBalance), color: 'text-gray-700' },
                  { label: 'Closing', value: formatRs(s.closingBalance), color: 'text-gray-700' },
                  { label: 'Sales', value: formatRs(s.calculatedSales), color: 'text-green-700' },
                  { label: 'Expenses', value: formatRs(s.totalExpenses), color: 'text-red-600' },
                  { label: 'Credits', value: formatRs(s.totalCredits), color: 'text-orange-600' },
                  { label: 'Profit', value: formatRs(s.profit), color: 'text-blue-700 font-bold' },
                ].map(({ label: l, value, color: c }) => (
                  <div key={l} className={`${lightBg} rounded-xl p-3`}>
                    <p className="text-xs text-gray-500">{l}</p>
                    <p className={`text-sm font-semibold mt-1 ${c}`}>{loading ? '...' : value}</p>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

