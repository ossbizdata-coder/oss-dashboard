import { Link } from 'react-router-dom'
import { Coffee, BookOpen, UtensilsCrossed, ArrowRight } from 'lucide-react'
import { PageHeader, formatRs } from '../components/ui.jsx'
import { useEffect, useState } from 'react'
import { transactionApi } from '../services/api.js'
import { format } from 'date-fns'

const SHOPS = [
  { code: 'CAFE', label: 'Cafe', icon: Coffee, color: '#068A4B', bg: 'bg-[#068A4B]', lightBg: 'bg-green-50' },
  { code: 'BOOKSHOP', label: 'Bookshop', icon: BookOpen, color: '#1565C0', bg: 'bg-[#1565C0]', lightBg: 'bg-blue-50' },
  { code: 'FOODHUT', label: 'Food Hut', icon: UtensilsCrossed, color: '#B65505', bg: 'bg-[#B65505]', lightBg: 'bg-orange-50' },
]

export default function ShopsPage() {
  const [summaries, setSummaries] = useState({})
  const [loading, setLoading] = useState(true)
  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    Promise.allSettled(
      SHOPS.map(s => transactionApi.getDepartmentSummary(s.code, today).then(r => ({ code: s.code, data: r.data })))
    ).then(results => {
      const map = {}
      results.forEach(r => { if (r.status === 'fulfilled') map[r.value.code] = r.value.data })
      setSummaries(map)
      setLoading(false)
    })
  }, [])

  return (
    <div>
      <PageHeader title="Shop Operations" subtitle="Daily performance across all 3 shops" />

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

