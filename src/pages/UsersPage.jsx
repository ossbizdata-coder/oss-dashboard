import { useEffect, useState } from 'react'
import { userApi } from '../services/api.js'
import { PageHeader, LoadingSpinner } from '../components/ui.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { Users, Pencil, Trash2, RefreshCw, X, Check, ShieldAlert } from 'lucide-react'

const ROLES = ['ADMIN', 'SUPERADMIN', 'MANAGER', 'STAFF', 'CUSTOMER']

const ROLE_COLORS = {
  SUPERADMIN: 'bg-red-100 text-red-700',
  ADMIN:      'bg-blue-100 text-blue-700',
  MANAGER:    'bg-purple-100 text-purple-700',
  STAFF:      'bg-green-100 text-green-700',
  CUSTOMER:   'bg-gray-100 text-gray-600',
}

export default function UsersPage() {
  const { isSuperAdmin, user: me } = useAuth()
  const [users, setUsers]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [editUser, setEditUser] = useState(null)   // user being edited
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null) // id to confirm delete
  const [error, setError]       = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await userApi.getAll()
      setUsers(res.data || [])
    } catch (e) {
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openEdit = (u) => setEditUser({ ...u, newPassword: '' })
  const closeEdit = () => setEditUser(null)

  const saveEdit = async () => {
    setSaving(true)
    try {
      const payload = {
        name:     editUser.name,
        email:    editUser.email,
        role:     editUser.role,
        dailySalary:      editUser.dailySalary,
        hourlyRate:       editUser.hourlyRate,
        deductionRatePerHour: editUser.deductionRatePerHour,
      }
      // Only send password if user typed a new one
      if (editUser.newPassword?.trim()) {
        payload.password = editUser.newPassword.trim()
      }
      await userApi.update(editUser.id, payload)
      closeEdit()
      await load()
    } catch (e) {
      alert('Failed to save: ' + (e?.response?.data || e.message))
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = (id) => setDeleteConfirm(id)
  const cancelDelete  = ()   => setDeleteConfirm(null)

  const doDelete = async (id) => {
    setDeleting(id)
    try {
      await userApi.delete(id)
      setDeleteConfirm(null)
      await load()
    } catch (e) {
      alert('Failed to delete: ' + (e?.response?.data || e.message))
    } finally {
      setDeleting(null)
    }
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
        <ShieldAlert size={48} />
        <p className="font-medium">SuperAdmin access required</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="User Management"
        subtitle="View, edit and manage all system users"
        action={
          <button onClick={load} className="btn-outline flex items-center gap-2 text-sm">
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">{error}</div>
      )}

      {loading ? <LoadingSpinner /> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="pb-3 pr-4 font-medium">Name</th>
                <th className="pb-3 pr-4 font-medium">Email</th>
                <th className="pb-3 pr-4 font-medium">Role</th>
                <th className="pb-3 pr-4 font-medium text-right">Daily Salary</th>
                <th className="pb-3 pr-4 font-medium text-right">Hourly Rate</th>
                <th className="pb-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs flex-shrink-0">
                        {(u.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-800">{u.name}</span>
                      {u.email === me?.email && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">You</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-gray-500">{u.email}</td>
                  <td className="py-3 pr-4">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right text-gray-600">Rs {u.dailySalary?.toFixed(0) ?? '—'}</td>
                  <td className="py-3 pr-4 text-right text-gray-600">Rs {u.hourlyRate?.toFixed(0) ?? '—'}</td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(u)}
                        className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </button>
                      {deleteConfirm === u.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-red-600 font-medium">Confirm?</span>
                          <button
                            onClick={() => doDelete(u.id)}
                            disabled={deleting === u.id}
                            className="p-1 text-white bg-red-500 hover:bg-red-600 rounded-lg text-xs px-2 disabled:opacity-50"
                          >
                            {deleting === u.id ? '…' : 'Yes'}
                          </button>
                          <button onClick={cancelDelete} className="p-1 text-gray-500 hover:bg-gray-100 rounded-lg">
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => confirmDelete(u.id)}
                          disabled={u.email === me?.email}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title={u.email === me?.email ? "Can't delete yourself" : "Delete"}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 mt-3">{users.length} users total</p>
        </div>
      )}

      {/* Edit Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={closeEdit}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-800 text-lg">Edit User</h2>
              <button onClick={closeEdit} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Full Name</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  value={editUser.name || ''}
                  onChange={e => setEditUser(u => ({ ...u, name: e.target.value }))}
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  value={editUser.email || ''}
                  onChange={e => setEditUser(u => ({ ...u, email: e.target.value }))}
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
                <select
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  value={editUser.role || ''}
                  onChange={e => setEditUser(u => ({ ...u, role: e.target.value }))}
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {/* Daily Salary + Hourly Rate */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Daily Salary (Rs)</label>
                  <input
                    type="number"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                    value={editUser.dailySalary ?? ''}
                    onChange={e => setEditUser(u => ({ ...u, dailySalary: parseFloat(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Hourly Rate (Rs)</label>
                  <input
                    type="number"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                    value={editUser.hourlyRate ?? ''}
                    onChange={e => setEditUser(u => ({ ...u, hourlyRate: parseFloat(e.target.value) }))}
                  />
                </div>
              </div>

              {/* New Password (optional) */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">New Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span></label>
                <input
                  type="password"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  value={editUser.newPassword || ''}
                  onChange={e => setEditUser(u => ({ ...u, newPassword: e.target.value }))}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={closeEdit} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 bg-primary-700 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-primary-800 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? 'Saving…' : <><Check size={15} /> Save Changes</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

