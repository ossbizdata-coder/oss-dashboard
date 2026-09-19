import { useState, useEffect } from 'react'
import { dailyCashApi, salaryApi, creditApi, reportApi } from '../services/api.js'
import { PageHeader, LoadingSpinner, EmptyState, formatRs } from '../components/ui.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { BarChart3, AlertCircle } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LabelList
} from 'recharts'
import useBusinessSettings from '../hooks/useBusinessSettings.js'
import {
  calculateReloadAdjustedProfit,
  getTotalFixedMonthlyExpenses,
  sanitizeDisplayText,
  toNumber,
} from '../utils/businessSettings.js'

const SHOP_NAMES = { CAFE: 'Cafe', BOOKSHOP: 'Bookshop', FOODHUT: 'Food Hut' }
const COLORS = ['#22c55e', '#3f51b5', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899']
const getReloadByShop = (expenseItems = []) => {
  if (!Array.isArray(expenseItems)) return {}
  return expenseItems.reduce((acc, item) => {
    const typeName = String(item?.expenseTypeName || '').trim().toLowerCase()
    if (typeName !== 'reload') return acc
    const shopCode = String(item?.shopCode || '').toUpperCase()
    if (!shopCode) return acc
    acc[shopCode] = (acc[shopCode] || 0) + Math.max(0, toNumber(item?.amount))
    return acc
  }, {})
}

export default function ReportsPage() {
  const { isSuperAdmin } = useAuth()
  const [reportType, setReportType] = useState('monthly')
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [businessSettings] = useBusinessSettings(selectedMonth)
  const [shopData, setShopData] = useState([])
  const [expenseData, setExpenseData] = useState([])
  const [topItemsData, setTopItemsData] = useState([])
  const [creditData, setCreditData] = useState([])
  const [profitData, setProfitData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const year = selectedMonth.getFullYear()
  const month = selectedMonth.getMonth() + 1
  const monthKey = `${year}-${String(month).padStart(2, '0')}`

  const loadMonthlyReport = async () => {
    setLoading(true)
    setError(null)
    try {
      const salaryPromise = isSuperAdmin ? salaryApi.getAdminMonthly(year, month) : Promise.resolve({ data: [] })

      const [summary, monthlyExpenses, allCredits, salaries] = await Promise.allSettled([
        dailyCashApi.getMonthlySummary(year, month),
        reportApi.getMonthlyExpenseItems(year, month),
        creditApi.getAll(),
        salaryPromise,
      ])
      const monthlyExpenseItems = monthlyExpenses.status === 'fulfilled'
        ? (monthlyExpenses.value.data || [])
        : []
      const reloadByShop = getReloadByShop(monthlyExpenseItems)

      let currentShopData = []

      if (summary.status === 'fulfilled') {
        const shops = summary.value.data?.shops || summary.value.data || []
        currentShopData = shops
          .filter((shop) => SHOP_NAMES[shop.shopCode])
          .map((shop) => {
            const sales = toNumber(shop.totalSales)
            const credits = toNumber(shop.totalCredits)
            const cash = Math.max(0, sales - credits)
            const expenses = toNumber(shop.totalExpenses)
            const profit = calculateReloadAdjustedProfit(sales, reloadByShop[shop.shopCode] || 0)
            const margin = sales > 0 ? (profit / sales) * 100 : 0

            return {
              name: SHOP_NAMES[shop.shopCode] || shop.shopCode,
              code: shop.shopCode,
              cash,
              credits,
              revenue: sales,
              expenses,
              profit,
              margin,
            }
          })
        setShopData(currentShopData)
      } else {
        setShopData([])
      }

      if (monthlyExpenseItems.length > 0) {
        const groupedByType = {}
        const groupedByItem = {}

        monthlyExpenseItems.forEach((item) => {
          const amount = toNumber(item.amount)
          const typeName = sanitizeDisplayText(item.expenseTypeName, 'Other')
          const itemName = sanitizeDisplayText(item.description, typeName)

          groupedByType[typeName] = (groupedByType[typeName] || 0) + amount
          groupedByItem[itemName] = (groupedByItem[itemName] || 0) + amount
        })

        setExpenseData(
          Object.entries(groupedByType)
            .map(([name, value]) => ({ name, value }))
            .sort((left, right) => right.value - left.value)
        )
        setTopItemsData(
          Object.entries(groupedByItem)
            .map(([name, value]) => ({ name, value }))
            .sort((left, right) => right.value - left.value)
        )
      } else {
        setExpenseData([])
        setTopItemsData([])
      }

      const filteredCredits = allCredits.status === 'fulfilled'
        ? (allCredits.value.data || []).filter((credit) => String(credit.transactionDate || '').startsWith(monthKey))
        : []

      setCreditData([
        { name: 'Paid', value: filteredCredits.filter((credit) => credit.isPaid).reduce((sum, credit) => sum + toNumber(credit.amount), 0) },
        { name: 'Unpaid', value: filteredCredits.filter((credit) => !credit.isPaid).reduce((sum, credit) => sum + toNumber(credit.amount), 0) },
      ])

      if (isSuperAdmin && salaries.status === 'fulfilled') {
        const totalSalaries = (salaries.value.data || []).reduce((sum, row) => sum + toNumber(row.totalSalary), 0)
        const totalRevenue = currentShopData.reduce((sum, item) => sum + item.revenue, 0)
        const totalExpenses = currentShopData.reduce((sum, item) => sum + item.expenses, 0)
        const totalGrossProfit = currentShopData.reduce((sum, item) => sum + item.profit, 0)
        const fixedMonthlyExpenses = getTotalFixedMonthlyExpenses(businessSettings)

        setProfitData({
          totalRevenue,
          totalExpenses,
          totalSalaries,
          fixedMonthlyExpenses,
          grossProfit: totalGrossProfit,
          netProfit: totalGrossProfit - totalSalaries - fixedMonthlyExpenses,
        })
      } else {
        setProfitData(null)
      }
    } catch (err) {
      console.error(err)
      setError('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadMonthlyReport() }, [year, month, isSuperAdmin, businessSettings])

  const totalRevenue = shopData.reduce((sum, item) => sum + item.revenue, 0)
  const totalExpenses = shopData.reduce((sum, item) => sum + item.expenses, 0)
  const totalProfit = shopData.reduce((sum, item) => sum + item.profit, 0)
  const hasData = shopData.length > 0 || expenseData.length > 0 || topItemsData.length > 0 || creditData.some((item) => item.value > 0)

  return (
    <div className="pb-10">
      <PageHeader
        title="Monthly Reports"
        subtitle="Business performance analytics"
        action={(
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedMonth(new Date(year, month - 2, 1))} className="p-2 hover:bg-gray-100 rounded-lg">←</button>
            <input
              type="month"
              value={`${year}-${String(month).padStart(2, '0')}`}
              onChange={(event) => {
                const [selectedYear, selectedMonthValue] = event.target.value.split('-')
                setSelectedMonth(new Date(selectedYear, selectedMonthValue - 1, 1))
              }}
              className="px-3 py-2 border rounded-xl text-sm font-bold"
            />
            <button onClick={() => setSelectedMonth(new Date(year, month, 1))} className="p-2 hover:bg-gray-100 rounded-lg">→</button>
          </div>
        )}
      />

      <div className="card mb-6 flex flex-wrap items-center justify-end gap-4">
        <div className="flex flex-wrap gap-2">
          {['monthly', 'expense', 'items', 'credit', 'profit']
            .filter((key) => key !== 'profit' || isSuperAdmin)
            .map((key) => (
              <button
                key={key}
                onClick={() => setReportType(key)}
                className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${
                  reportType === key ? 'bg-primary-700 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {key === 'monthly'
                  ? 'Summary'
                  : key === 'expense'
                    ? 'Expenses by Category'
                    : key === 'items'
                      ? 'Expenses by Item'
                      : key === 'credit'
                        ? 'Credits'
                        : 'Profit'}
              </button>
            ))}
        </div>
      </div>

      {loading ? <LoadingSpinner /> : error ? (
        <div className="card text-red-600 flex items-center gap-2"><AlertCircle size={18} /> {error}</div>
      ) : !hasData ? (
        <EmptyState icon={BarChart3} title="No Records" />
      ) : (
        <div className="space-y-6">
          {reportType === 'monthly' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card text-center border-t-4 border-green-500">
                  <p className="text-xs text-gray-500 font-bold">REVENUE</p>
                  <p className="text-2xl font-bold text-green-700">{formatRs(totalRevenue)}</p>
                </div>
                <div className="card text-center border-t-4 border-red-500">
                  <p className="text-xs text-gray-500 font-bold">TOTAL EXPENSES</p>
                  <p className="text-2xl font-bold text-red-600">{formatRs(totalExpenses)}</p>
                </div>
                <div className="card text-center border-t-4 border-primary-500">
                  <p className="text-xs text-gray-500 font-bold">GROSS PROFIT</p>
                  <p className="text-2xl font-bold text-primary-700">{formatRs(totalProfit)}</p>
                </div>
              </div>
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 border-b">
                      <th className="p-3 text-left">Department</th>
                      <th className="p-3 text-right">Revenue</th>
                      <th className="p-3 text-right">Credits</th>
                      <th className="p-3 text-right text-green-700">Calculated Sales</th>
                      <th className="p-3 text-right">Expenses</th>
                      <th className="p-3 text-right text-primary-700">Profit</th>
                      <th className="p-3 text-right">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shopData.map((item) => (
                      <tr key={item.code} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-bold">{item.name}</td>
                        <td className="p-3 text-right">{formatRs(item.cash)}</td>
                        <td className="p-3 text-right text-orange-500">{formatRs(item.credits)}</td>
                        <td className="p-3 text-right font-bold text-green-700 bg-green-50/30">{formatRs(item.revenue)}</td>
                        <td className="p-3 text-right text-red-500">{formatRs(item.expenses)}</td>
                        <td className="p-3 text-right font-bold text-primary-700">{formatRs(item.profit)}</td>
                        <td className="p-3 text-right font-bold">{item.margin.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card h-[350px]">
                  <h3 className="font-bold mb-4">Revenue vs Expenses</h3>
                  <ResponsiveContainer>
                    <BarChart data={shopData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(value) => `${value / 1000}k`} />
                      <Tooltip formatter={(value) => formatRs(value)} />
                      <Legend />
                      <Bar dataKey="revenue" name="Calculated Sales" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="card h-[350px]">
                  <h3 className="font-bold mb-4">Profit by Department</h3>
                  <ResponsiveContainer>
                    <BarChart data={shopData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(value) => `${value / 1000}k`} />
                      <Tooltip formatter={(value) => formatRs(value)} />
                      <Bar dataKey="profit" name="Profit" fill="#3f51b5" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {reportType === 'expense' && (
            expenseData.length === 0 ? (
              <EmptyState icon={BarChart3} title="No monthly expenses" description="No expense records were found for this month." />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card h-[400px]">
                  <h3 className="font-bold mb-4">Expenses by Category</h3>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={expenseData}
                        cx="50%"
                        cy="50%"
                        outerRadius={120}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {expenseData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(value) => formatRs(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="card">
                  <h3 className="font-bold mb-4">Category Details</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-gray-500">
                        <th className="pb-2 text-left">Category</th>
                        <th className="pb-2 text-right">Amount</th>
                        <th className="pb-2 text-right">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenseData.map((item) => (
                        <tr key={item.name} className="border-b">
                          <td className="py-2 font-medium">{item.name}</td>
                          <td className="py-2 text-right font-bold text-red-600">{formatRs(item.value)}</td>
                          <td className="py-2 text-right text-gray-500">{(totalExpenses > 0 ? (item.value / totalExpenses) * 100 : 0).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {reportType === 'items' && (
            topItemsData.length === 0 ? (
              <EmptyState icon={BarChart3} title="No itemized expenses" description="No itemized expense records were found for this month." />
            ) : (
              <div className="card">
                <h3 className="font-bold mb-6">Top Itemized Expenses</h3>
                <div className="h-[600px]">
                  <ResponsiveContainer>
                    <BarChart data={topItemsData.slice(0, 30)} layout="vertical" margin={{ left: 40, right: 100 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={180} tick={{ fontSize: 11, fontWeight: 500 }} />
                      <Tooltip formatter={(value) => formatRs(value)} />
                      <Bar dataKey="value" fill="#3f51b5" radius={[0, 4, 4, 0]} barSize={25}>
                        <LabelList dataKey="value" position="right" formatter={(value) => formatRs(value)} style={{ fontSize: 12, fontWeight: 'bold', fill: '#4b5563' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )
          )}

          {reportType === 'credit' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card h-[400px]">
                <h3 className="font-bold mb-4">Credit Status</h3>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={creditData}
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${formatRs(value)}`}
                    >
                      <Cell fill="#22c55e" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip formatter={(value) => formatRs(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-4">
                {creditData.map((item) => (
                  <div key={item.name} className={`card text-center p-8 border-l-8 ${item.name === 'Paid' ? 'border-green-500' : 'border-red-500'}`}>
                    <p className="text-sm font-bold uppercase text-gray-500">{item.name} Credits</p>
                    <p className="text-4xl font-bold mt-2">{formatRs(item.value)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reportType === 'profit' && profitData && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="card border-b-4 border-green-500"><p className="text-xs font-bold text-gray-500">REVENUE</p><p className="text-xl font-bold">{formatRs(profitData.totalRevenue)}</p></div>
                <div className="card border-b-4 border-red-500"><p className="text-xs font-bold text-gray-500">OPERATING EXP.</p><p className="text-xl font-bold">{formatRs(profitData.totalExpenses)}</p></div>
                <div className="card border-b-4 border-blue-500"><p className="text-xs font-bold text-gray-500">GROSS PROFIT</p><p className="text-xl font-bold">{formatRs(profitData.grossProfit)}</p></div>
                <div className="card border-b-4 border-orange-500"><p className="text-xs font-bold text-gray-500">STAFF SALARIES</p><p className="text-xl font-bold">{formatRs(profitData.totalSalaries)}</p></div>
                <div className="card bg-primary-50 border-b-4 border-primary-500"><p className="text-xs font-bold text-primary-700">NET PROFIT</p><p className="text-xl font-bold">{formatRs(profitData.netProfit)}</p><p className="text-xs text-primary-700 mt-1">Fixed expenses: {formatRs(profitData.fixedMonthlyExpenses)}</p></div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
