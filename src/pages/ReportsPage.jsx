import { useState, useEffect } from 'react'
import { transactionApi, dailyCashApi, salaryApi } from '../services/api.js'
import { PageHeader, LoadingSpinner, EmptyState, formatRs } from '../components/ui.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { BarChart3, Download, FileText, AlertCircle } from 'lucide-react'
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
    // Clear previous data to avoid stale UI
    setShopData([])
    setExpenseData([])
    setTopItemsData([])
    setCreditData([])
    setProfitData(null)

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

      let currentShopData = []

      // Department Monthly Summary
      if (summary.status === 'fulfilled') {
        const shops = summary.value.data?.shops || []
        currentShopData = shops.map(s => ({
          name: SHOP_NAMES[s.shopCode] || s.shopCode,
          code: s.shopCode,
          Sales: Math.round(s.totalSales || 0),
          Expenses: Math.round(s.totalExpenses || 0),
          Profit: Math.round(s.totalSales - s.totalExpenses || 0),
          Credits: Math.round(s.totalCredits || 0),
        }))
        setShopData(currentShopData)
      } else {
        console.error("Summary error:", summary.reason)
      }

      // Expense Breakdown by Type & Item
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

        setExpenseData(Object.entries(aggByType).map(([type, amount]) => ({
          name: type,
          value: amount,
        })).sort((a, b) => b.value - a.value))

        setTopItemsData(Object.entries(aggByItem).map(([name, amount]) => ({
          name,
          value: amount,
        })).sort((a, b) => b.value - a.value))
      }

      // Credit Report
      if (credits.status === 'fulfilled') {
        const creds = credits.value.data || []
        const creditByStatus = {
          paid: creds.filter(c => c.isPaid).reduce((s, c) => s + (c.amount || 0), 0),
          unpaid: creds.filter(c => !c.isPaid).reduce((s, c) => s + (c.amount || 0), 0),
        }
        setCreditData([
          { name: 'Paid', value: creditByStatus.paid },
          { name: 'Unpaid', value: creditByStatus.unpaid },
        ])
      }

      // Profit Report
      if (isSuperAdmin && salaries.status === 'fulfilled') {
        const totalSalaries = salaries.value.data?.reduce((s, r) => s + (r.totalSalary || 0), 0) || 0
        const totalShopSales = currentShopData.reduce((s, d) => s + d.Sales, 0)
        const totalShopExpenses = currentShopData.reduce((s, d) => s + d.Expenses, 0)
        const netProfit = totalShopSales - totalShopExpenses - totalSalaries
        setProfitData({ totalSalaries, netProfit, totalShopSales, totalShopExpenses })
      }
    } catch (err) {
      setError("Failed to load report data. Please try again.")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isSuperAdmin && reportType === 'profit') {
      setReportType('monthly')
    }
    loadMonthlyReport()
  }, [year, month, isSuperAdmin])

  const exportToCSV = (data, filename) => {
    if (!data || data.length === 0) return
    const csv = [
      ['Report Type:', reportType],
      ['Month:', `${String(month).padStart(2, '0')}/${year}`],
      ['Generated:', new Date().toLocaleString()],
      [],
      [Object.keys(data[0] || {}).join(',')],
      ...data.map(row => Object.values(row).join(',')),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleMonthChange = (offset) => {
    setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1))
  }

  const totalSales = shopData.reduce((s, d) => s + d.Sales, 0)
  const totalExpenses = shopData.reduce((s, d) => s + d.Expenses, 0)
  const totalProfit = shopData.reduce((s, d) => s + d.Profit, 0)
  const totalCredits = shopData.reduce((s, d) => s + d.Credits, 0)

  const hasData = shopData.length > 0 || expenseData.length > 0 || creditData.length > 0

  return (
    <div className="pb-10">
      <PageHeader title="Monthly Reports" subtitle="Financial analytics and performance summaries" />

      {/* Selectors */}
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
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button onClick={() => handleMonthChange(1)} className="p-2 hover:bg-gray-100 rounded-lg">→</button>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { key: 'monthly', label: 'Monthly Summary' },
              { key: 'expense', label: 'Expenses by Category' },
              { key: 'items', label: 'Expenses by Item' },
              { key: 'credit', label: 'Credit Report' },
              ...(isSuperAdmin ? [{ key: 'profit', label: 'Profit Report' }] : []),
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setReportType(key)}
                className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                  reportType === key ? 'bg-primary-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              const dataMap = { monthly: shopData, expense: expenseData, items: topItemsData, credit: creditData }
              exportToCSV(dataMap[reportType], `${reportType}-report-${year}-${month}.csv`)
            }}
            disabled={!hasData || loading}
            className="btn-outline flex items-center gap-2 text-sm px-4 py-2 disabled:opacity-50"
          >
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      {loading && <LoadingSpinner />}

      {error && (
        <div className="card bg-red-50 border-red-200 flex items-center gap-3 text-red-700 py-4 mb-6">
          <AlertCircle size={20} />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {!loading && !error && !hasData && (
        <EmptyState icon={BarChart3} title="No data found" description={`No activity recorded for ${format(selectedMonth, 'MMMM yyyy')}`} />
      )}

      {!loading && !error && hasData && (
        <>
          {/* Monthly Summary */}
          {reportType === 'monthly' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="card text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-700 mt-1">{formatRs(totalSales)}</p>
                </div>
                <div className="card text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">{formatRs(totalExpenses)}</p>
                </div>
                <div className="card text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Gross Profit</p>
                  <p className="text-2xl font-bold text-primary-700 mt-1">{formatRs(totalProfit)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="card">
                  <h3 className="font-semibold text-gray-800 mb-4">Revenue vs Expenses</h3>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={shopData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                        <Tooltip formatter={v => formatRs(v)} />
                        <Legend />
                        <Bar dataKey="Sales" fill="#22c55e" radius={[4,4,0,0]} />
                        <Bar dataKey="Expenses" fill="#ef4444" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="card">
                  <h3 className="font-semibold text-gray-800 mb-4">Profit by Department</h3>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={shopData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                        <Tooltip formatter={v => formatRs(v)} />
                        <Bar dataKey="Profit" fill="#3f51b5" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="card overflow-x-auto">
                <h3 className="font-semibold text-gray-800 mb-4">Department Breakdown</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="pb-3 font-medium">Department</th>
                      <th className="pb-3 font-medium text-right">Sales</th>
                      <th className="pb-3 font-medium text-right">Expenses</th>
                      <th className="pb-3 font-medium text-right">Credits</th>
                      <th className="pb-3 font-medium text-right">Profit</th>
                      <th className="pb-3 font-medium text-right">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shopData.map(d => (
                      <tr key={d.code} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-3 font-semibold text-gray-800">{d.name}</td>
                        <td className="py-3 text-right text-green-700">{formatRs(d.Sales)}</td>
                        <td className="py-3 text-right text-red-500">{formatRs(d.Expenses)}</td>
                        <td className="py-3 text-right text-orange-500">{formatRs(d.Credits)}</td>
                        <td className="py-3 text-right font-bold text-primary-700">{formatRs(d.Profit)}</td>
                        <td className="py-3 text-right text-gray-500">{d.Sales > 0 ? `${((d.Profit / d.Sales) * 100).toFixed(1)}%` : '—'}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-bold border-t-2 border-gray-100">
                      <td className="py-3">TOTAL</td>
                      <td className="py-3 text-right text-green-700">{formatRs(totalSales)}</td>
                      <td className="py-3 text-right text-red-500">{formatRs(totalExpenses)}</td>
                      <td className="py-3 text-right text-orange-500">{formatRs(totalCredits)}</td>
                      <td className="py-3 text-right text-primary-700">{formatRs(totalProfit)}</td>
                      <td className="py-3 text-right text-gray-500">{totalSales > 0 ? `${((totalProfit / totalSales) * 100).toFixed(1)}%` : '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Expenses by Category */}
          {reportType === 'expense' && (
            expenseData.length > 0 ? (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <div className="card">
                    <h3 className="font-semibold text-gray-800 mb-4">Distribution by Category</h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={expenseData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                            {expenseData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={v => formatRs(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="card">
                    <h3 className="font-semibold text-gray-800 mb-4">Category Amounts</h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={expenseData} layout="vertical" margin={{ left: 20, right: 40 }}>
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={v => formatRs(v)} />
                          <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]}>
                            <LabelList dataKey="value" position="right" formatter={v => formatRs(v)} style={{ fontSize: '10px' }} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
                <div className="card">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="pb-3 font-medium">Category</th>
                        <th className="pb-3 font-medium text-right">Amount</th>
                        <th className="pb-3 font-medium text-right">% of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenseData.map(e => (
                        <tr key={e.name} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-3 font-semibold text-gray-800">{e.name}</td>
                          <td className="py-3 text-right text-red-600">{formatRs(e.value)}</td>
                          <td className="py-3 text-right text-gray-500">{((e.value / totalExpenses) * 100).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : <EmptyState icon={FileText} title="No category data" description="No categorized expenses found." />
          )}

          {/* Expenses by Item */}
          {reportType === 'items' && (
            topItemsData.length > 0 ? (
              <>
                <div className="card mb-6">
                  <h3 className="font-semibold text-gray-800 mb-4">Top 30 Expense Items</h3>
                  <div className="h-[600px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topItemsData.slice(0, 30)} layout="vertical" margin={{ left: 20, right: 100 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={v => formatRs(v)} />
                        <Bar dataKey="value" fill="#3f51b5" radius={[0, 4, 4, 0]} barSize={20}>
                          <LabelList dataKey="value" position="right" formatter={v => formatRs(v)} style={{ fontSize: '11px', fontWeight: 'bold' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="card">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="pb-3 font-medium">Description</th>
                        <th className="pb-3 font-medium text-right">Amount</th>
                        <th className="pb-3 font-medium text-right">% of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topItemsData.map(e => (
                        <tr key={e.name} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-3 font-medium text-gray-800">{e.name}</td>
                          <td className="py-3 text-right text-red-600 font-bold">{formatRs(e.value)}</td>
                          <td className="py-3 text-right text-gray-500">{((e.value / totalExpenses) * 100).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : <EmptyState icon={FileText} title="No items found" description="No expense descriptions available." />
          )}

          {/* Credit Report */}
          {reportType === 'credit' && (
            <>
              <div className="grid grid-cols-2 gap-4 mb-6">
                {creditData.map(c => (
                  <div key={c.name} className="card text-center">
                    <p className="text-xs text-gray-500 uppercase font-semibold">{c.name} Credits</p>
                    <p className={`text-2xl font-bold mt-1 ${c.name === 'Paid' ? 'text-green-700' : 'text-red-600'}`}>
                      {formatRs(c.value)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="card">
                <h3 className="font-semibold text-gray-800 mb-4">Paid vs Unpaid Distribution</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={creditData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        <Cell fill="#22c55e" /><Cell fill="#ef4444" />
                      </Pie>
                      <Tooltip formatter={v => formatRs(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {/* Profit Report */}
          {reportType === 'profit' && profitData && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="card text-center"><p className="text-xs text-gray-500 font-bold">SALES</p><p className="text-xl font-bold text-green-700">{formatRs(profitData.totalShopSales)}</p></div>
                <div className="card text-center"><p className="text-xs text-gray-500 font-bold">EXPENSES</p><p className="text-xl font-bold text-red-600">{formatRs(profitData.totalShopExpenses)}</p></div>
                <div className="card text-center"><p className="text-xs text-gray-500 font-bold">SALARIES</p><p className="text-xl font-bold text-orange-600">{formatRs(profitData.totalSalaries)}</p></div>
                <div className="card text-center bg-primary-50"><p className="text-xs text-gray-500 font-bold">NET PROFIT</p><p className={`text-xl font-bold ${profitData.netProfit >= 0 ? 'text-primary-700' : 'text-red-600'}`}>{formatRs(profitData.netProfit)}</p></div>
              </div>
              <div className="card mb-6">
                <h3 className="font-semibold text-gray-800 mb-4">Calculation Overview</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'Sales', val: profitData.totalShopSales, fill: '#22c55e' },
                      { name: 'Op. Exp', val: -profitData.totalShopExpenses, fill: '#ef4444' },
                      { name: 'Salaries', val: -profitData.totalSalaries, fill: '#f59e0b' },
                      { name: 'Net', val: profitData.netProfit, fill: '#3f51b5' },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
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
            </>
          )}
        </>
      )}
    </div>
  )
}
