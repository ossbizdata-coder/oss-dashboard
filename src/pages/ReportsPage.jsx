import { useState } from 'react'
import { transactionApi } from '../services/api.js'
import { PageHeader, LoadingSpinner, EmptyState, formatRs } from '../components/ui.jsx'
import { BarChart3, Search } from 'lucide-react'
import { format, subDays } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line
} from 'recharts'

const SHOPS = ['CAFE', 'BOOKSHOP', 'FOODHUT']

export default function ReportsPage() {
  const [fromDate, setFromDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [shopData, setShopData] = useState([])
  const [loading, setLoading] = useState(false)

  const runReport = async () => {
    setLoading(true)
    // Fetch today's summary for each shop for quick report
    const results = await Promise.allSettled(
      SHOPS.map(s => transactionApi.getDepartmentSummary(s, toDate).then(r => ({ shop: s, ...r.data })))
    )
    const data = results
      .filter(r => r.status === 'fulfilled')
      .map(r => ({
        name: r.value.shop === 'BOOKSHOP' ? 'Bookshop' : r.value.shop.charAt(0) + r.value.shop.slice(1).toLowerCase(),
        Sales: Math.round(r.value.calculatedSales || 0),
        Expenses: Math.round(r.value.totalExpenses || 0),
        Profit: Math.round(r.value.profit || 0),
        Credits: Math.round(r.value.totalCredits || 0),
      }))
    setShopData(data)
    setLoading(false)
  }

  const totalSales = shopData.reduce((s, d) => s + d.Sales, 0)
  const totalExpenses = shopData.reduce((s, d) => s + d.Expenses, 0)
  const totalProfit = shopData.reduce((s, d) => s + d.Profit, 0)

  return (
    <div>
      <PageHeader title="Business Reports" subtitle="Financial analytics and performance summaries" />

      {/* Filter Bar */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">From Date</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">To Date</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <button onClick={runReport} className="btn-primary flex items-center gap-2 text-sm px-6 py-2">
            <Search size={16} /> Generate Report
          </button>
        </div>
      </div>

      {loading && <LoadingSpinner />}

      {shopData.length > 0 && (
        <>
          {/* Summary Totals */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="card text-center">
              <p className="text-xs text-gray-500">Total Revenue</p>
              <p className="text-2xl font-bold text-green-700 mt-1">{formatRs(totalSales)}</p>
            </div>
            <div className="card text-center">
              <p className="text-xs text-gray-500">Total Expenses</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{formatRs(totalExpenses)}</p>
            </div>
            <div className="card text-center">
              <p className="text-xs text-gray-500">Net Profit</p>
              <p className="text-2xl font-bold text-primary-700 mt-1">{formatRs(totalProfit)}</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-4">Revenue vs Expenses</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={shopData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => formatRs(v)} />
                  <Legend />
                  <Bar dataKey="Sales" fill="#22c55e" radius={[4,4,0,0]} name="Sales" />
                  <Bar dataKey="Expenses" fill="#ef4444" radius={[4,4,0,0]} name="Expenses" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-4">Profit by Shop</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={shopData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => formatRs(v)} />
                  <Bar dataKey="Profit" fill="#3f51b5" radius={[4,4,0,0]} name="Profit" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Data Table */}
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-4">Breakdown by Shop</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-3 font-medium">Shop</th>
                  <th className="pb-3 font-medium text-right">Sales</th>
                  <th className="pb-3 font-medium text-right">Expenses</th>
                  <th className="pb-3 font-medium text-right">Credits</th>
                  <th className="pb-3 font-medium text-right">Profit</th>
                  <th className="pb-3 font-medium text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {shopData.map(d => (
                  <tr key={d.name} className="border-b border-gray-50">
                    <td className="py-3 font-semibold text-gray-800">{d.name}</td>
                    <td className="py-3 text-right text-green-700">{formatRs(d.Sales)}</td>
                    <td className="py-3 text-right text-red-500">{formatRs(d.Expenses)}</td>
                    <td className="py-3 text-right text-orange-500">{formatRs(d.Credits)}</td>
                    <td className="py-3 text-right font-bold text-primary-700">{formatRs(d.Profit)}</td>
                    <td className="py-3 text-right text-gray-500">
                      {d.Sales > 0 ? `${((d.Profit / d.Sales) * 100).toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold">
                  <td className="py-3 font-bold">TOTAL</td>
                  <td className="py-3 text-right text-green-700">{formatRs(totalSales)}</td>
                  <td className="py-3 text-right text-red-500">{formatRs(totalExpenses)}</td>
                  <td className="py-3 text-right text-orange-500">{formatRs(shopData.reduce((s,d)=>s+d.Credits,0))}</td>
                  <td className="py-3 text-right font-bold text-primary-700">{formatRs(totalProfit)}</td>
                  <td className="py-3 text-right text-gray-500">
                    {totalSales > 0 ? `${((totalProfit / totalSales) * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {shopData.length === 0 && !loading && (
        <EmptyState icon={BarChart3} title="Run a report" description="Select a date range and click Generate Report to see analytics" />
      )}
    </div>
  )
}

