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

const toNumber = (v) => {
  const n = parseFloat(v)
  return isNaN(n) ? 0 : n
}

export default function ReportsPage() {
  const { isSuperAdmin } = useAuth()
  const [reportType, setReportType] = useState('monthly')
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
      const salaryPromise = isSuperAdmin ? salaryApi.getAdminMonthly(year, month) : Promise.resolve({ data: [] })

      const [summary, expenses, credits, salaries] = await Promise.allSettled([
        dailyCashApi.getMonthlySummary(year, month),
        dailyCashApi.getMonthlyExpenses(year, month),
        dailyCashApi.getMonthlyCredits(year, month),
        salaryPromise,
      ])

      let currentShopData = []
      let backupExpenses = []

      // 1. Process Monthly Summary (MARGIN FIX)
      if (summary.status === 'fulfilled') {
        const shops = summary.value.data?.shops || summary.value.data || []
        currentShopData = shops.map(s => {
          const cash = toNumber(s.totalSales)
          const creds = toNumber(s.totalCredits)
          const exps = toNumber(s.totalExpenses)

          // Formula: Revenue = Cash + Credits
          const revenue = cash + creds
          const profit = revenue - exps
          const margin = revenue > 0 ? (profit / revenue) * 100 : 0

          // Collect internal expenses for fallback
          if (Array.isArray(s.expenses)) {
            backupExpenses = [...backupExpenses, ...s.expenses]
          }

          return {
            name: SHOP_NAMES[s.shopCode] || s.shopCode,
            code: s.shopCode,
            cash,
            credits: creds,
            revenue,
            expenses: exps,
            profit,
            margin
          }
        }).filter(s => s.revenue > 0 || s.expenses > 0)
        setShopData(currentShopData)
      }

      // 2. Process Expenses (With Fallback)
      const expsList = (expenses.status === 'fulfilled' && Array.isArray(expenses.value.data))
        ? expenses.value.data
        : backupExpenses

      if (expsList.length > 0) {
        const aggByType = {}
        const aggByItem = {}
        expsList.forEach(e => {
          const type = e.expenseTypeName || 'Other'
          const item = e.description || type
          const amt = toNumber(e.amount)
          aggByType[type] = (aggByType[type] || 0) + amt
          aggByItem[item] = (aggByItem[item] || 0) + amt
        })
        setExpenseData(Object.entries(aggByType).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value))
        setTopItemsData(Object.entries(aggByItem).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value))
      } else {
        setExpenseData([])
        setTopItemsData([])
      }

      // 3. Process Credits
      if (credits.status === 'fulfilled') {
        const list = Array.isArray(credits.value.data) ? credits.value.data : []
        setCreditData([
          { name: 'Paid', value: list.filter(c => c.isPaid).reduce((s, c) => s + toNumber(c.amount), 0) },
          { name: 'Unpaid', value: list.filter(c => !c.isPaid).reduce((s, c) => s + toNumber(c.amount), 0) },
        ])
      }

      // 4. Process Net Profit
      if (isSuperAdmin && salaries.status === 'fulfilled') {
        const totalSalaries = salaries.value.data?.reduce((s, r) => s + toNumber(r.totalSalary), 0) || 0
        const totalRevenue = currentShopData.reduce((s, d) => s + d.revenue, 0)
        const totalExpenses = currentShopData.reduce((s, d) => s + d.expenses, 0)
        setProfitData({ totalSalaries, netProfit: totalRevenue - totalExpenses - totalSalaries, totalRevenue, totalExpenses })
      }

    } catch (err) {
      console.error(err)
      setError("Failed to load reports")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadMonthlyReport() }, [year, month, isSuperAdmin])

  const totalRevenue = shopData.reduce((s, d) => s + d.revenue, 0)
  const totalExpenses = shopData.reduce((s, d) => s + d.expenses, 0)
  const totalProfit = shopData.reduce((s, d) => s + d.profit, 0)
  const hasData = shopData.length > 0 || expenseData.length > 0

  return (
    <div className="pb-10">
      <PageHeader title="Monthly Reports" subtitle="Business performance analytics" />

      <div className="card mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedMonth(new Date(year, month - 2, 1))} className="p-2 hover:bg-gray-100 rounded-lg">←</button>
          <input type="month" value={`${year}-${String(month).padStart(2, '0')}`} onChange={e => {
            const [y, m] = e.target.value.split('-'); setSelectedMonth(new Date(y, m-1, 1))
          }} className="px-3 py-2 border rounded-xl text-sm font-bold" />
          <button onClick={() => setSelectedMonth(new Date(year, month, 1))} className="p-2 hover:bg-gray-100 rounded-lg">→</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {['monthly', 'expense', 'items', 'credit', 'profit'].filter(k => k !== 'profit' || isSuperAdmin).map(k => (
            <button key={k} onClick={() => setReportType(k)} className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${reportType === k ? 'bg-primary-700 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {k === 'monthly' ? 'Summary' : k === 'expense' ? 'Expenses by Category' : k === 'items' ? 'Expenses by Item' : k === 'credit' ? 'Credits' : 'Profit'}
            </button>
          ))}
        </div>
      </div>

      {loading ? <LoadingSpinner /> : error ? <div className="card text-red-600 flex items-center gap-2"><AlertCircle size={18}/> {error}</div> : !hasData ? <EmptyState icon={BarChart3} title="No Records" /> : (
        <div className="space-y-6">
          {reportType === 'monthly' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card text-center border-t-4 border-green-500"><p className="text-xs text-gray-500 font-bold">REVENUE (CASH+CREDIT)</p><p className="text-2xl font-bold text-green-700">{formatRs(totalRevenue)}</p></div>
                <div className="card text-center border-t-4 border-red-500"><p className="text-xs text-gray-500 font-bold">TOTAL EXPENSES</p><p className="text-2xl font-bold text-red-600">{formatRs(totalExpenses)}</p></div>
                <div className="card text-center border-t-4 border-primary-500"><p className="text-xs text-gray-500 font-bold">GROSS PROFIT</p><p className="text-2xl font-bold text-primary-700">{formatRs(totalProfit)}</p></div>
              </div>
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 border-b"><th className="p-3 text-left">Shop</th><th className="p-3 text-right">Cash</th><th className="p-3 text-right">Credits</th><th className="p-3 text-right text-green-700">Revenue</th><th className="p-3 text-right">Expenses</th><th className="p-3 text-right text-primary-700">Profit</th><th className="p-3 text-right">Margin</th></tr>
                  </thead>
                  <tbody>
                    {shopData.map(d => (
                      <tr key={d.code} className="border-b hover:bg-gray-50"><td className="p-3 font-bold">{d.name}</td><td className="p-3 text-right">{formatRs(d.cash)}</td><td className="p-3 text-right text-orange-500">{formatRs(d.credits)}</td><td className="p-3 text-right font-bold text-green-700 bg-green-50/30">{formatRs(d.revenue)}</td><td className="p-3 text-right text-red-500">{formatRs(d.expenses)}</td><td className="p-3 text-right font-bold text-primary-700">{formatRs(d.profit)}</td><td className="p-3 text-right font-bold">{d.margin.toFixed(1)}%</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card h-[350px]"><h3 className="font-bold mb-4">Revenue vs Expenses</h3><ResponsiveContainer><BarChart data={shopData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis tickFormatter={v => `${v/1000}k`}/><Tooltip formatter={v => formatRs(v)}/><Legend/><Bar dataKey="revenue" name="Revenue" fill="#22c55e" radius={[4,4,0,0]}/><Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
                <div className="card h-[350px]"><h3 className="font-bold mb-4">Profit by Shop</h3><ResponsiveContainer><BarChart data={shopData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis tickFormatter={v => `${v/1000}k`}/><Tooltip formatter={v => formatRs(v)}/><Bar dataKey="profit" name="Profit" fill="#3f51b5" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
              </div>
            </>
          )}

          {reportType === 'expense' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card h-[400px]"><h3 className="font-bold mb-4">Expenses by Category</h3><ResponsiveContainer><PieChart><Pie data={expenseData} cx="50%" cy="50%" outerRadius={120} dataKey="value" label={({name, percent}) => `${name} ${(percent*100).toFixed(0)}%`}>{expenseData.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip formatter={v => formatRs(v)}/></PieChart></ResponsiveContainer></div>
              <div className="card"><h3 className="font-bold mb-4">Category Details</h3><table className="w-full text-sm"><thead><tr className="border-b text-gray-500"><th className="pb-2 text-left">Category</th><th className="pb-2 text-right">Amount</th><th className="pb-2 text-right">%</th></tr></thead><tbody>{expenseData.map(e => (<tr key={e.name} className="border-b"><td className="py-2 font-medium">{e.name}</td><td className="py-2 text-right font-bold text-red-600">{formatRs(e.value)}</td><td className="py-2 text-right text-gray-500">{(totalExpenses > 0 ? (e.value/totalExpenses)*100 : 0).toFixed(1)}%</td></tr>))}</tbody></table></div>
            </div>
          )}

          {reportType === 'items' && (
            <div className="card"><h3 className="font-bold mb-6">Top Itemized Expenses</h3><div className="h-[600px]"><ResponsiveContainer><BarChart data={topItemsData.slice(0,30)} layout="vertical" margin={{left:40, right:100}}><CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false}/><XAxis type="number" hide/><YAxis dataKey="name" type="category" width={180} tick={{fontSize:11, fontWeight:500}}/><Tooltip formatter={v => formatRs(v)}/><Bar dataKey="value" fill="#3f51b5" radius={[0,4,4,0]} barSize={25}><LabelList dataKey="value" position="right" formatter={v => formatRs(v)} style={{fontSize:12, fontWeight:'bold', fill:'#4b5563'}}/></Bar></BarChart></ResponsiveContainer></div></div>
          )}

          {reportType === 'credit' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card h-[400px]"><h3 className="font-bold mb-4">Credit Status</h3><ResponsiveContainer><PieChart><Pie data={creditData} cx="50%" cy="50%" outerRadius={120} dataKey="value" label={({name, value}) => `${name}: ${formatRs(value)}`}><Cell fill="#22c55e"/><Cell fill="#ef4444"/></Pie><Tooltip formatter={v => formatRs(v)}/></PieChart></ResponsiveContainer></div>
              <div className="flex flex-col gap-4">{creditData.map(c => (<div key={c.name} className={`card text-center p-8 border-l-8 ${c.name === 'Paid' ? 'border-green-500' : 'border-red-500'}`}><p className="text-sm font-bold uppercase text-gray-500">{c.name} Credits</p><p className="text-4xl font-bold mt-2">{formatRs(c.value)}</p></div>))}</div>
            </div>
          )}

          {reportType === 'profit' && profitData && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card border-b-4 border-green-500"><p className="text-xs font-bold text-gray-500">REVENUE</p><p className="text-xl font-bold">{formatRs(profitData.totalRevenue)}</p></div>
                <div className="card border-b-4 border-red-500"><p className="text-xs font-bold text-gray-500">OPERATING EXP.</p><p className="text-xl font-bold">{formatRs(profitData.totalExpenses)}</p></div>
                <div className="card border-b-4 border-orange-500"><p className="text-xs font-bold text-gray-500">STAFF SALARIES</p><p className="text-xl font-bold">{formatRs(profitData.totalSalaries)}</p></div>
                <div className="card bg-primary-50 border-b-4 border-primary-500"><p className="text-xs font-bold text-primary-700">NET PROFIT</p><p className="text-xl font-bold">{formatRs(profitData.netProfit)}</p></div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
