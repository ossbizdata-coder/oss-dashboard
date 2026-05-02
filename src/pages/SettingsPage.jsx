import { useEffect, useState } from 'react'
import { expenseTypeApi, userApi } from '../services/api.js'
import { PageHeader, LoadingSpinner, EmptyState, RoleBadge } from '../components/ui.jsx'
import { Settings, Trash2, Plus, Users, Tag } from 'lucide-react'

export default function SettingsPage() {
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState([])
  const [expenseTypes, setExpenseTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [newExpense, setNewExpense] = useState('')
  const [adding, setAdding] = useState(false)

  const load = async () => {
    setLoading(true)
    const [u, e] = await Promise.allSettled([userApi.getAll(), expenseTypeApi.getAll()])
    if (u.status === 'fulfilled') setUsers(u.value.data || [])
    if (e.status === 'fulfilled') setExpenseTypes(e.value.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleAddExpense = async () => {
    if (!newExpense.trim()) return
    setAdding(true)
    await expenseTypeApi.create({ name: newExpense.trim() })
    setNewExpense('')
    await load()
    setAdding(false)
  }

  const handleDeleteExpense = async (id) => {
    if (!confirm('Delete this expense type?')) return
    await expenseTypeApi.delete(id)
    load()
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage users, expense types, and system configuration" />

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { key: 'users', label: 'Users', icon: Users },
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
          {tab === 'users' && (
            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-4">
                All Users ({users.length})
              </h2>
              {users.length === 0
                ? <EmptyState icon={Users} title="No users found" />
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-100">
                          <th className="pb-3 pr-4 font-medium">Name</th>
                          <th className="pb-3 pr-4 font-medium">Email</th>
                          <th className="pb-3 pr-4 font-medium">Role</th>
                          <th className="pb-3 font-medium">Shop</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-3 pr-4 font-medium text-gray-800">{u.name}</td>
                            <td className="py-3 pr-4 text-gray-500">{u.email}</td>
                            <td className="py-3 pr-4"><RoleBadge role={u.role} /></td>
                            <td className="py-3 text-gray-400 text-xs">{u.shopCode || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              }
            </div>
          )}

          {tab === 'expenses' && (
            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-4">Expense Types</h2>

              {/* Add new */}
              <div className="flex gap-3 mb-6">
                <input
                  type="text"
                  placeholder="New expense type name..."
                  value={newExpense}
                  onChange={e => setNewExpense(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddExpense()}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  onClick={handleAddExpense}
                  disabled={adding || !newExpense.trim()}
                  className="btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
                >
                  <Plus size={16} /> Add
                </button>
              </div>

              {expenseTypes.length === 0
                ? <EmptyState icon={Tag} title="No expense types" description="Add expense types to categorize shop expenses" />
                : (
                  <div className="space-y-2">
                    {expenseTypes.map(e => (
                      <div key={e.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                        <div>
                          <p className="font-medium text-gray-800 text-sm">{e.name}</p>
                          {e.description && <p className="text-xs text-gray-400">{e.description}</p>}
                        </div>
                        <button
                          onClick={() => handleDeleteExpense(e.id)}
                          className="text-red-400 hover:text-red-600 p-1 rounded transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          )}
        </>
      )}
    </div>
  )
}

