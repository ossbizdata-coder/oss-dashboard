import { useEffect, useState } from 'react'
import { Tag, Trash2, Plus, Percent, Wallet, Save } from 'lucide-react'
import { Badge, EmptyState, LoadingSpinner, PageHeader } from '../components/ui.jsx'
import { expenseTypeApi } from '../services/api.js'
import { getBusinessSettings, saveBusinessSettings, sanitizeDisplayText } from '../utils/businessSettings.js'

const SHOP_OPTIONS = [
  { value: 'COMMON', label: 'Common' },
  { value: 'CAFE', label: 'Cafe' },
  { value: 'BOOKSHOP', label: 'Bookshop' },
  { value: 'FOODHUT', label: 'Food Hut' },
]

const PROFIT_RATE_FIELDS = [
  { code: 'CAFE', label: 'Cafe' },
  { code: 'BOOKSHOP', label: 'Bookshop' },
  { code: 'FOODHUT', label: 'Food Hut' },
]

export default function SettingsPage() {
  const [tab, setTab] = useState('business')
  const [expenseTypes, setExpenseTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [newExpense, setNewExpense] = useState('')
  const [newExpenseShopType, setNewExpenseShopType] = useState('COMMON')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [businessSettings, setBusinessSettings] = useState(() => getBusinessSettings())

  const load = async () => {
    setLoading(true)
    setBusinessSettings(getBusinessSettings())
    try {
      const response = await expenseTypeApi.getAll()
      setExpenseTypes(response.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleAddExpense = async () => {
    if (!newExpense.trim()) return
    setAdding(true)
    try {
      await expenseTypeApi.create({
        name: newExpense.trim(),
        shopType: newExpenseShopType,
      })
      setNewExpense('')
      await load()
    } catch (error) {
      alert(error?.response?.data || error.message)
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteExpense = async (id) => {
    if (!confirm('Delete this expense type?')) return
    await expenseTypeApi.delete(id)
    await load()
  }

  const handleSaveBusinessSettings = () => {
    setSaving(true)
    const saved = saveBusinessSettings(businessSettings)
    setBusinessSettings(saved)
    window.setTimeout(() => setSaving(false), 400)
  }

  const updateProfitRate = (shopCode, value) => {
    setBusinessSettings((current) => ({
      ...current,
      profitRates: {
        ...current.profitRates,
        [shopCode]: value,
      },
    }))
  }

  const updateFixedExpense = (field, value) => {
    setBusinessSettings((current) => ({
      ...current,
      fixedMonthlyExpenses: {
        ...current.fixedMonthlyExpenses,
        [field]: value,
      },
    }))
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage business profit settings and expense types" />

      <div className="flex gap-2 mb-4">
        {[
          { key: 'business', label: 'Business Settings', icon: Percent },
          { key: 'expenses', label: 'Expense Types', icon: Tag },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === key ? 'bg-primary-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          {tab === 'business' && (
            <div className="space-y-5">
              <div className="card">
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="font-semibold text-gray-800">Profit Rates</h2>
                    <p className="text-sm text-gray-500 mt-1">Used for dashboard, shop, monthly summary, and monthly report profit calculations.</p>
                  </div>
                  <button
                    onClick={handleSaveBusinessSettings}
                    disabled={saving}
                    className="btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
                  >
                    <Save size={16} /> {saving ? 'Saved' : 'Save'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {PROFIT_RATE_FIELDS.map(({ code, label }) => (
                    <label key={code} className="block">
                      <span className="block text-xs font-medium text-gray-500 mb-1.5">{label} Profit Rate (%)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={businessSettings.profitRates?.[code] ?? ''}
                        onChange={(event) => updateProfitRate(code, event.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="flex items-center gap-2 mb-4">
                  <Wallet size={18} className="text-primary-700" />
                  <h2 className="font-semibold text-gray-800">Fixed Monthly Expenses</h2>
                </div>
 
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'rent', label: 'Rent' },
                    { key: 'electric', label: 'Electricity' },
                    { key: 'internet', label: 'Internet' },
                    { key: 'other', label: 'Other' },
                  ].map(({ key, label }) => (
                    <label key={key} className="block">
                      <span className="block text-xs font-medium text-gray-500 mb-1.5">{label}</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={businessSettings.fixedMonthlyExpenses?.[key] ?? ''}
                        onChange={(event) => updateFixedExpense(key, event.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </label>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl bg-primary-50 px-4 py-3">
                  <p className="text-xs font-medium text-primary-700 uppercase tracking-wide">Monthly Fixed Expense Total</p>
                  <p className="text-2xl font-bold text-primary-900 mt-1">
                    {Object.values(businessSettings.fixedMonthlyExpenses || {}).reduce((sum, value) => sum + Number(value || 0), 0).toLocaleString('en-LK', { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {tab === 'expenses' && (
            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-4">Expense Types</h2>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-3 mb-6">
                <input
                  type="text"
                  placeholder="New expense type name..."
                  value={newExpense}
                  onChange={event => setNewExpense(event.target.value)}
                  onKeyDown={event => event.key === 'Enter' && handleAddExpense()}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <select
                  value={newExpenseShopType}
                  onChange={event => setNewExpenseShopType(event.target.value)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {SHOP_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <button
                  onClick={handleAddExpense}
                  disabled={adding || !newExpense.trim()}
                  className="btn-primary flex items-center justify-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
                >
                  <Plus size={16} /> Add
                </button>
              </div>

              {expenseTypes.length === 0
                ? <EmptyState icon={Tag} title="No expense types" description="Add expense types to categorize shop expenses" />
                : (
                  <div className="space-y-2">
                    {expenseTypes
                      .slice()
                      .sort((a, b) => sanitizeDisplayText(a.name, '').localeCompare(sanitizeDisplayText(b.name, '')))
                      .map((expenseType) => (
                        <div key={expenseType.id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl">
                          <div>
                            <p className="font-medium text-gray-800 text-sm">{sanitizeDisplayText(expenseType.name)}</p>
                            <div className="mt-1">
                              <Badge color="blue">{sanitizeDisplayText(expenseType.shopType, 'Common')}</Badge>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteExpense(expenseType.id)}
                            className="text-red-400 hover:text-red-600 p-1 rounded transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                  </div>
                )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
