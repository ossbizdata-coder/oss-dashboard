import { useState, useEffect } from 'react'
import { dailyCashApi, salaryApi } from '../services/api.js'
import { PageHeader, LoadingSpinner, EmptyState, formatRs } from '../components/ui.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { BarChart3, Download, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LabelList
} from 'recharts'

const SHOP_NAMES = { CAFE: 'Cafe', BOOKSHOP: 'Bookshop', FOODHUT: 'Food Hut' }
const COLORS = ['#22c55e', '#3f51b5', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899']

export default function ReportsPage() {
  const { isSuperAdmin } = useAuth()
  const [reportType, setReportType] = useState('monthly') // 'monthly' | 'expense' | 'items' | 'credit' | 'profit'
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [shopData, setShopData] = useState([])
  const [expenseData, setExpenseData] = useState([])
  const [topItemsData, setTopItemsData] = useState([])
  const [creditData, setCreditData] = useState([])
  const [profitData, setProfitData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const year = selectedMonth.getFullYear()
  const month = selectedMonth.getMonth() + 1

  const loadMonthlyReport = async () => {
    setLoading(true)
    setError(null)
    try {
      const salaryPromise = isSuperAdmin
        ? salaryApi.getAdminMonthly(year, month)
        : Promise.resolve({ data: [] })

      const [summary, expenses, credits, salaries] = await Promise.allSettled([
        dailyCashApi.getMonthlySummary(year, month),
        dailyCashApi.getMonthlyExpenses(year, month),
        dailyCashApi.getMonthlyCredits(year, month),
        salaryPromise,
      ])

      let processedShops = []

      // 1. Process Monthly Summary
      if (summary.status === 'fulfilled') {
        const shops = summary.value.data?.shops || []
        processedShops = shops.map(s => {
          const cashSales = Math.round(s.totalSales || 0)
          const expensesVal = Math.round(s.totalExpenses || 0)
          const creditsVal = Math.round(s.totalCredits || 0)
          const totalRevenue = cashSales + creditsVal
          const profit = totalRevenue - expensesVal
          const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0

          return {
            name: SHOP_NAMES[s.shopCode] || s.shopCode,
            code: s.shopCode,
            cashSales,
            expenses: expensesVal,
            credits: creditsVal,
            revenue: totalRevenue,
            profit,
            margin
          }
        })
        setShopData(processedShops)
      }

      // 2. Process Expenses by Category & Item
      if (expenses.status === 'fulfilled') {
        const exps = expenses.value.data || []
        const aggByType = {}
        const aggByItem = {}

        exps.forEach(e => {
          const type = e.expenseTypeName || 'Other'
          const item = e.description || e.expenseTypeName || 'Other'
          if (!aggByType[type]) aggByType[type] = 0
          aggByType[type] += e.amount || 0
          if (!aggByItem[item]) aggByItem[item] = 0
          aggByItem[item] += e.amount || 0
        })

        setExpenseData(Object.entries(aggByType)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value))

        setTopItemsData(Object.entries(aggByItem)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value))
      }

      // 3. Process Credits
      if (credits.status === 'fulfilled') {
        const creds = credits.value.data || []
        setCreditData([
          { name: 'Paid', value: creds.filter(c => c.isPaid).reduce((s, c) => s + (c.amount || 0), 0) },
          { name: 'Unpaid', value: creds.filter(c => !c.isPaid).reduce((s, c) => s + (c.amount || 0), 0) },
        ])
      }

      // 4. Process Profit Report (Admin only)
      if (isSuperAdmin && salaries.status === 'fulfilled') {
        const totalSalaries = salaries.value.data?.reduce((s, r) => s + (r.totalSalary || 0), 0) || 0
        const totalRevenue = processedShops.reduce((s, d) => s + d.revenue, 0)
        const totalExpenses = processedShops.reduce((s, d) => s + d.expenses, 0)
        const netProfit = totalRevenue - totalExpenses - totalSalaries
        setProfitData({ totalSalaries, netProfit, totalRevenue, totalExpenses })
      } else {
        setProfitData(null)
      }

    } catch (err) {
      console.error("Load report error:", err)
      setError("Failed to load report data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMonthlyReport()
  }, [year, month, isSuperAdmin])

  const handleMonthChange = (offset) => {
    setSelectedMonth(new Date(year, month - 1 + offset, 1))
  }

  const exportToCSV = (data, filename) => {
    if (!data || data.length === 0) return
    const headers = Object.keys(data[0]).join(',')
    const rows = data.map(row => Object.values(row).join(',')).join('\n')
    const csv = `Report: ${filename}\nGenerated: ${new Date().toLocaleString()}\n\n${headers}\n${rows}`
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
  }

  const totalRevenue = shopData.reduce((s, d) => s + d.revenue, 0)
  const totalExpenses = shopData.reduce((s, d) => s + d.expenses, 0)
  const totalProfit = shopData.reduce((s, d) => s + d.profit, 0)
  const hasData = shopData.length > 0 || expenseData.length > 0 || creditData.length > 0

  return (
    <div className="pb-10">
      <PageHeader title="Monthly Reports" subtitle="Financial analytics and summaries" />

      {/* Month & Type Selector */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => handleMonthChange(-1)} className="p-2 hover:bg-gray-100 rounded-lg">←</button>
            <input
              type="month"
              value={`${year}-${String(month).padStart(2, '0')}`}
              onChange={e => {
                const [y, m] = e.target.value.split('-')
                if (y && m) setSelectedMonth(new Date(parseInt(y), parseInt(m) - 1, 1))
              }}
              className="px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button onClick={() => handleMonthChange(1)} className="p-2 hover:bg-gray-100 rounded-lg">→</button>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { k: 'monthly', l: 'Monthly Summary' },
              { k: 'expense', l: 'Expenses by Category' },
              { k: 'items', l: 'Expenses by Item' },
              { k: 'credit', l: 'Credit Report' },
              ...(isSuperAdmin ? [{ k: 'profit', l: 'Profit Report' }] : []),
            ].map(({ k, l }) => (
              <button key={k} onClick={() => setReportType(k)}
                className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${reportType === k ? 'bg-primary-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {l}
              </button>
            ))}
          </div>

          <button onClick={() => {
            const dataMap = { monthly: shopData, expense: expenseData, items: topItemsData, credit: creditData }
            exportToCSV(dataMap[reportType], `${reportType}-report-${year}-${month}.csv`)
          }} className="btn-outline flex items-center gap-2 text-sm px-4 py-2 disabled:opacity-50" disabled={!hasData}>
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      {loading ? <LoadingSpinner /> : error ? (
        <div className="card bg-red-50 text-red-700 p-4 flex items-center gap-2"><AlertCircle size={18} /> {error}</div>
      ) : !hasData ? (
        <EmptyState icon={BarChart3} title="No Data" description={`No activity found for ${format(selectedMonth, 'MMMM yyyy')}`} />
      ) : (
        <div className="space-y-6">
          {/* Monthly Summary */}
          {reportType === 'monthly' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card text-center">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-700 mt-1">{formatRs(totalRevenue)}</p>
                  <p className="text-[10px] text-gray-400 mt-1">(Cash + Credits)</p>
                </div>
                <div className="card text-center">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">{formatRs(totalExpenses)}</p>
                </div>
                <div className="card text-center">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Gross Profit</p>
                  <p className="text-2xl font-bold text-primary-700 mt-1">{formatRs(totalProfit)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card h-[400px]">
                  <h3 className="font-bold text-gray-800 mb-6">Revenue vs Expenses</h3>
                  <ResponsiveContainer width="100%" height="90%">
                    <BarChart data={shopData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={v => formatRs(v)} />
                      <Legend />
                      <Bar dataKey="revenue" name="Total Revenue" fill="#22c55e" radius={[4,4,0,0]} />
                      <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="card h-[400px]">
                  <h3 className="font-bold text-gray-800 mb-6">Profit by Department</h3>
                  <ResponsiveContainer width="100%" height="90%">
                    <BarChart data={shopData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={v => formatRs(v)} />
                      <Bar dataKey="profit" name="Gross Profit" fill="#3f51b5" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card overflow-x-auto">
                <h3 className="font-semibold text-gray-800 mb-4">Department Breakdown</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="pb-3 font-medium">Department</th>
                      <th className="pb-3 font-medium text-right">Cash Sales</th>
                      <th className="pb-3 font-medium text-right">Credits</th>
                      <th className="pb-3 font-medium text-right">Revenue</th>
                      <th className="pb-3 font-medium text-right">Expenses</th>
                      <th className="pb-3 font-medium text-right">Profit</th>
                      <th className="pb-3 font-medium text-right">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shopData.map(d => (
                      <tr key={d.code} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-3 font-semibold text-gray-800">{d.name}</td>
                        <td className="py-3 text-right text-gray-600">{formatRs(d.cashSales)}</td>
                        <td className="py-3 text-right text-orange-500">{formatRs(d.credits)}</td>
                        <td className="py-3 text-right text-green-700 font-medium">{formatRs(d.revenue)}</td>
                        <td className="py-3 text-right text-red-500">{formatRs(d.expenses)}</td>
                        <td className="py-3 text-right font-bold text-primary-700">{formatRs(d.profit)}</td>
                        <td className="py-3 text-right text-gray-500">{d.margin.toFixed(1)}%</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-bold border-t-2 border-gray-100">
                      <td className="py-3">TOTAL</td>
                      <td className="py-3 text-right">{formatRs(shopData.reduce((s,d)=>s+d.cashSales,0))}</td>
                      <td className="py-3 text-right text-orange-600">{formatRs(shopData.reduce((s,d)=>s+d.credits,0))}</td>
                      <td className="py-3 text-right text-green-700">{formatRs(totalRevenue)}</td>
                      <td className="py-3 text-right text-red-600">{formatRs(totalExpenses)}</td>
                      <td className="py-3 text-right text-primary-700">{formatRs(totalProfit)}</td>
                      <td className="py-3 text-right">{totalRevenue > 0 ? ((totalProfit/totalRevenue)*100).toFixed(1) : 0}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Expenses by Category */}
          {reportType === 'expense' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card h-[450px]">
                <h3 className="font-bold text-gray-800 mb-4">By Category</h3>
                <ResponsiveContainer width="100%" height="90%">
                  <PieChart>
                    <Pie
                      data={expenseData}
                      cx="50%" cy="50%"
                      outerRadius={120}
                      dataKey="value"
                      label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {expenseData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={v => formatRs(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="card flex flex-col">
                <h3 className="font-bold text-gray-800 mb-4">Category Details</h3>
                <div className="overflow-auto flex-1">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b text-gray-500">
                        <th className="pb-2 font-medium">Category</th>
                        <th className="pb-2 text-right font-medium">Amount</th>
                        <th className="pb-2 text-right font-medium">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenseData.map(e => (
                        <tr key={e.name} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-3 text-gray-800 font-medium">{e.name}</td>
                          <td className="py-3 text-right font-bold text-red-600">{formatRs(e.value)}</td>
                          <td className="py-3 text-right text-gray-500">{(totalExpenses > 0 ? (e.value/totalExpenses)*100 : 0).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Expenses by Item */}
          {reportType === 'items' && (
            <div className="card">
              <h3 className="font-bold text-gray-800 mb-6">Top 30 Expense Items</h3>
              <div className="h-[700px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topItemsData.slice(0, 30)} layout="vertical" margin={{ left: 40, right: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={180} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={v => formatRs(v)} />
                    <Bar dataKey="value" fill="#3f51b5" radius={[0, 4, 4, 0]} barSize={25}>
                      <LabelList dataKey="value" position="right" formatter={v => formatRs(v)} style={{ fontSize: 12, fontWeight: 'bold', fill: '#4b5563' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Credit Report */}
          {reportType === 'credit' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card h-[400px]">
                <h3 className="font-bold text-gray-800 mb-4">Credit Status Distribution</h3>
                <ResponsiveContainer width="100%" height="90%">
                  <PieChart>
                    <Pie
                      data={creditData}
                      cx="50%" cy="50%"
                      outerRadius={120}
                      dataKey="value"
                      label={({name, value}) => `${name}: ${formatRs(value)}`}
                    >
                      <Cell fill="#22c55e" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip formatter={v => formatRs(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-4">
                {creditData.map(c => (
                  <div key={c.name} className="card text-center p-8">
                    <p className="text-sm text-gray-500 font-semibold uppercase tracking-wider">{c.name} Credits</p>
                    <p className={`text-4xl font-bold mt-2 ${c.name === 'Paid' ? 'text-green-700' : 'text-red-600'}`}>
                      {formatRs(c.value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Profit Report (Admin only) */}
          {reportType === 'profit' && profitData && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card text-center"><p className="text-xs text-gray-500 font-bold uppercase">Total Revenue</p><p className="text-xl font-bold text-green-700 mt-1">{formatRs(profitData.totalRevenue)}</p></div>
                <div className="card text-center"><p className="text-xs text-gray-500 font-bold uppercase">Operating Exp.</p><p className="text-xl font-bold text-red-600 mt-1">{formatRs(profitData.totalExpenses)}</p></div>
                <div className="card text-center"><p className="text-xs text-gray-500 font-bold uppercase">Staff Salaries</p><p className="text-xl font-bold text-orange-600 mt-1">{formatRs(profitData.totalSalaries)}</p></div>
                <div className="card text-center bg-primary-50 border-primary-200"><p className="text-xs text-gray-500 font-bold uppercase text-primary-700">Net Profit</p><p className={`text-xl font-bold mt-1 ${profitData.netProfit >= 0 ? 'text-primary-700' : 'text-red-600'}`}>{formatRs(profitData.netProfit)}</p></div>
              </div>
              <div className="card h-[400px]">
                <h3 className="font-bold text-gray-800 mb-6">Net Profit Calculation Overview</h3>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={[
                    { name: 'Revenue', val: profitData.totalRevenue, fill: '#22c55e' },
                    { name: 'Shop Exp', val: -profitData.totalExpenses, fill: '#ef4444' },
                    { name: 'Salaries', val: -profitData.totalSalaries, fill: '#f59e0b' },
                    { name: 'Net Profit', val: profitData.netProfit, fill: '#3f51b5' },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={v => formatRs(Math.abs(v))} />
                    <Bar dataKey="val">
                      { [0,1,2,3].map(i => <Cell key={i} fill={['#22c55e', '#ef4444', '#f59e0b', '#3f51b5'][i]} />) }
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
