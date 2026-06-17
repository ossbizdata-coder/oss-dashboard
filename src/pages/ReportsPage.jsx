import { useState, useEffect } from 'react'
import { transactionApi, dailyCashApi, salaryApi } from '../services/api.js'
import { PageHeader, LoadingSpinner, EmptyState, formatRs } from '../components/ui.jsx'
import { BarChart3, Download, FileText } from 'lucide-react'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell
} from 'recharts'

const SHOPS = ['CAFE', 'BOOKSHOP', 'FOODHUT']
const SHOP_NAMES = { CAFE: 'Cafe', BOOKSHOP: 'Bookshop', FOODHUT: 'Food Hut' }
const COLORS = ['#22c55e', '#3f51b5', '#ef4444']

export default function ReportsPage() {
  const [reportType, setReportType] = useState('monthly') // 'monthly' | 'expense' | 'topitems' | 'credit' | 'profit'
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [shopData, setShopData] = useState([])
  const [expenseData, setExpenseData] = useState([])
  const [topItemsData, setTopItemsData] = useState([])
  const [creditData, setCreditData] = useState([])
  const [profitData, setProfitData] = useState(null)
  const [loading, setLoading] = useState(false)

  const year = selectedMonth.getFullYear()
  const month = selectedMonth.getMonth() + 1

  const loadMonthlyReport = async () => {
    setLoading(true)
    try {
      const [summary, expenses, credits, salaries] = await Promise.allSettled([
        dailyCashApi.getMonthlySummary(year, month),
        dailyCashApi.getMonthlyExpenses(year, month),
        dailyCashApi.getMonthlyCredits(year, month),
        salaryApi.getAdminMonthly(year, month),
      ])

      // Department Monthly Summary
      if (summary.status === 'fulfilled') {
        const shops = summary.value.data?.shops || []
        const data = shops.map(s => ({
          name: SHOP_NAMES[s.shopCode] || s.shopCode,
          code: s.shopCode,
          Sales: Math.round(s.totalSales || 0),
          Expenses: Math.round(s.totalExpenses || 0),
          Profit: Math.round(s.totalSales - s.totalExpenses || 0),
          Credits: Math.round(s.totalCredits || 0),
        }))
        setShopData(data)
      }

      // Expense Breakdown by Type
      if (expenses.status === 'fulfilled') {
        const exps = expenses.value.data || []
        const aggByType = {}
        exps.forEach(e => {
          const type = e.expenseTypeName || 'Other'
          if (!aggByType[type]) aggByType[type] = 0
          aggByType[type] += e.amount || 0
        })
        const expData = Object.entries(aggByType).map(([type, amount]) => ({
          name: type,
          value: amount,
        })).sort((a, b) => b.value - a.value)
        setExpenseData(expData)
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

      // Profit Report (all departments - salaries)
      if (salaries.status === 'fulfilled') {
        const totalSalaries = salaries.value.data?.reduce((s, r) => s + (r.totalSalary || 0), 0) || 0
        const totalShopSales = shopData.reduce((s, d) => s + d.Sales, 0)
        const totalShopExpenses = shopData.reduce((s, d) => s + d.Expenses, 0)
        const netProfit = totalShopSales - totalShopExpenses - totalSalaries
        setProfitData({ totalSalaries, netProfit, totalShopSales, totalShopExpenses })
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMonthlyReport()
  }, [year, month])

  const exportToCSV = (data, filename) => {
    const csv = [
      ['Report Type:', reportType],
      ['Month:', `${String(month).padStart(2, '0')}/${year}`],
      ['Generated:', new Date().toLocaleString()],
      [],
      ...(Array.isArray(data) ? [Object.keys(data[0] || {}).join(',')] : []),
      ...(Array.isArray(data) ? data.map(row => Object.values(row).join(',')) : []),
    ].map(row => Array.isArray(row) ? row.join(',') : row).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleMonthChange = (offset) => {
    const newMonth = new Date(year, month - 1 + offset, 1)
    setSelectedMonth(newMonth)
  }

  const totalSales = shopData.reduce((s, d) => s + d.Sales, 0)
  const totalExpenses = shopData.reduce((s, d) => s + d.Expenses, 0)
  const totalProfit = shopData.reduce((s, d) => s + d.Profit, 0)

  return (
    <div>
      <PageHeader title="Monthly Reports" subtitle="Financial analytics and performance summaries" />

      {/* Month Selector */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => handleMonthChange(-1)} className="p-2 hover:bg-gray-100 rounded-lg">←</button>
            <input
              type="month"
              value={`${year}-${String(month).padStart(2, '0')}`}
              onChange={e => {
                const [y, m] = e.target.value.split('-')
                setSelectedMonth(new Date(y, m - 1, 1))
              }}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button onClick={() => handleMonthChange(1)} className="p-2 hover:bg-gray-100 rounded-lg">→</button>
          </div>

          {/* Report Type Selector */}
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'monthly', label: 'Monthly Summary' },
              { key: 'expense', label: 'Expenses by Type' },
              { key: 'credit', label: 'Credit Report' },
              { key: 'profit', label: 'Profit Report' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setReportType(key)}
                className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                  reportType === key
                    ? 'bg-primary-700 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              if (reportType === 'monthly') exportToCSV(shopData, `monthly-report-${year}-${month}.csv`)
              else if (reportType === 'expense') exportToCSV(expenseData, `expense-report-${year}-${month}.csv`)
              else if (reportType === 'credit') exportToCSV(creditData, `credit-report-${year}-${month}.csv`)
            }}
            className="btn-outline flex items-center gap-2 text-sm px-4 py-2"
          >
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      {loading && <LoadingSpinner />}

      {/* Monthly Summary Report */}
      {reportType === 'monthly' && shopData.length > 0 && !loading && (
        <>
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
              <p className="text-xs text-gray-500">Gross Profit</p>
              <p className="text-2xl font-bold text-primary-700 mt-1">{formatRs(totalProfit)}</p>
            </div>
          </div>

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
                  <Bar dataKey="Sales" fill="#22c55e" radius={[4,4,0,0]} />
                  <Bar dataKey="Expenses" fill="#ef4444" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-4">Profit by Department</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={shopData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => formatRs(v)} />
                  <Bar dataKey="Profit" fill="#3f51b5" radius={[4,4,0,0]} />
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
                <tr className="bg-gray-50 font-semibold">
                  <td className="py-3 font-bold">TOTAL</td>
                  <td className="py-3 text-right text-green-700">{formatRs(totalSales)}</td>
                  <td className="py-3 text-right text-red-500">{formatRs(totalExpenses)}</td>
                  <td className="py-3 text-right text-orange-500">{formatRs(shopData.reduce((s,d)=>s+d.Credits,0))}</td>
                  <td className="py-3 text-right font-bold text-primary-700">{formatRs(totalProfit)}</td>
                  <td className="py-3 text-right text-gray-500">{totalSales > 0 ? `${((totalProfit / totalSales) * 100).toFixed(1)}%` : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Expense Breakdown Report */}
      {reportType === 'expense' && expenseData.length > 0 && !loading && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-4">Expenses by Type (Pie)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={expenseData} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${formatRs(value)}`} outerRadius={80} fill="#8884d8" dataKey="value">
                    {expenseData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={v => formatRs(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-4">Expenses by Type (Bar)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={expenseData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={v => formatRs(v)} />
                  <Bar dataKey="value" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-4">Expense Details</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-3 font-medium">Expense Type</th>
                  <th className="pb-3 font-medium text-right">Amount</th>
                  <th className="pb-3 font-medium text-right">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {expenseData.map(e => {
                  const total = expenseData.reduce((s, x) => s + x.value, 0)
                  return (
                    <tr key={e.name} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 font-semibold text-gray-800">{e.name}</td>
                      <td className="py-3 text-right text-red-600">{formatRs(e.value)}</td>
                      <td className="py-3 text-right text-gray-500">{((e.value / total) * 100).toFixed(1)}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Credit Report */}
      {reportType === 'credit' && creditData.length > 0 && !loading && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {creditData.map(c => (
              <div key={c.name} className="card text-center">
                <p className="text-xs text-gray-500">{c.name} Credits</p>
                <p className={`text-2xl font-bold mt-1 ${c.name === 'Paid' ? 'text-green-700' : 'text-red-600'}`}>
                  {formatRs(c.value)}
                </p>
              </div>
            ))}
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-4">Credit Status Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={creditData} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" label={({ name, value }) => `${name}: ${formatRs(value)}`}>
                  {creditData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#22c55e' : '#ef4444'} />
                  ))}
                </Pie>
                <Tooltip formatter={v => formatRs(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Profit Report (with Staff Salaries) */}
      {reportType === 'profit' && profitData && !loading && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="card text-center">
              <p className="text-xs text-gray-500">Total Sales</p>
              <p className="text-2xl font-bold text-green-700 mt-1">{formatRs(profitData.totalShopSales)}</p>
            </div>
            <div className="card text-center">
              <p className="text-xs text-gray-500">Operating Expenses</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{formatRs(profitData.totalShopExpenses)}</p>
            </div>
            <div className="card text-center">
              <p className="text-xs text-gray-500">Staff Salaries</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{formatRs(profitData.totalSalaries)}</p>
            </div>
            <div className="card text-center bg-gradient-to-br from-primary-50 to-white border-primary-200">
              <p className="text-xs text-gray-500">Net Profit</p>
              <p className={`text-2xl font-bold mt-1 ${profitData.netProfit >= 0 ? 'text-primary-700' : 'text-red-600'}`}>
                {formatRs(profitData.netProfit)}
              </p>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-4">Profit Breakdown</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={[
                { name: 'Sales', value: profitData.totalShopSales },
                { name: 'Expenses', value: -profitData.totalShopExpenses },
                { name: 'Salaries', value: -profitData.totalSalaries },
                { name: 'Net Profit', value: profitData.netProfit },
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => formatRs(v)} />
                <Bar dataKey="value" fill="#3f51b5" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card mt-6">
            <h3 className="font-semibold text-gray-800 mb-4">Profit Calculation</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Sales (all departments)</span>
                <span className="font-semibold text-green-700">+{formatRs(profitData.totalShopSales)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Operating Expenses</span>
                <span className="font-semibold text-red-600">-{formatRs(profitData.totalShopExpenses)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Staff Salaries</span>
                <span className="font-semibold text-orange-600">-{formatRs(profitData.totalSalaries)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between font-bold">
                <span>Net Profit</span>
                <span className={profitData.netProfit >= 0 ? 'text-primary-700' : 'text-red-600'}>
                  {formatRs(profitData.netProfit)}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {shopData.length === 0 && expenseData.length === 0 && creditData.length === 0 && !loading && (
        <EmptyState icon={BarChart3} title="No data available" description={`No data found for ${String(month).padStart(2, '0')}/${year}`} />
      )}
    </div>
  )
}

