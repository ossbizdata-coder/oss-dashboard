import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Inject JWT token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.clear()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── AUTH ──────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email, password) => api.post('/api/auth/login', { email, password }),
  getAllUsers: () => api.get('/api/auth/all-users'),
}

// ── DAILY CASH (correct data source) ─────────────────────────────────────
const SHOP_IDS = { CAFE: 1, BOOKSHOP: 2, FOODHUT: 3 }
export const dailyCashApi = {
  getSummary: (shopCode, date) => {
    const shopId = SHOP_IDS[shopCode?.toUpperCase()]
    if (!shopId) return Promise.reject(new Error(`Unknown shop: ${shopCode}`))
    return api.get(`/api/daily-cash/${shopId}/${date}`)
  },
  getMonthlySummary: (year, month) => api.get(`/api/daily-cash/monthly/${year}/${month}`),
  getMonthlyExpenses: (year, month) => api.get(`/api/expenses/monthly`, { params: { year, month } }),
  getMonthlyCredits: (year, month) => api.get(`/api/credits/monthly`, { params: { year, month } }),
  override: (dailyCashId, data) => api.patch(`/api/daily-cash/${dailyCashId}/override`, data),
}

// ── TRANSACTIONS ─────────────────────────────────────────────────────────
export const transactionApi = {
  getByDate: (department, date) =>
    api.get('/api/transactions/by-date', { params: { department, date } }),
  getDepartmentSummary: (department, date) =>
    api.get('/api/transactions/department-summary', { params: { department, date } }),
  getDailySummary: (department) =>
    api.get('/api/transactions/daily-summary', { params: { department } }),
  getCashTotal: (department) =>
    api.get('/api/transactions/department-cash-total', { params: { department } }),
  create: (data) => api.post('/api/transactions', data),
  update: (id, data) => api.put(`/api/transactions/${id}`, data),
  delete: (id) => api.delete(`/api/transactions/${id}`),
}

// ── CREDITS ───────────────────────────────────────────────────────────────
export const creditApi = {
  getAll: () => api.get('/api/credits'),
  getUnpaidTotal: () => api.get('/api/credits/outstanding-total'),
  getByShop: (shopCode, date) => api.get('/api/credits/by-shop', { params: { shopCode, date } }),
  create: (data) => api.post('/api/credits', data),
  markPaid: (id) => api.patch(`/api/credits/${id}`, { isPaid: true }),
  delete: (id) => api.delete(`/api/credits/${id}`),
}

// ── ATTENDANCE ─────────────────────────────────────────────────────────────
export const attendanceApi = {
  getAll: () => api.get('/api/attendance/all'),
  getToday: () => api.get('/api/attendance/today'),
}

// ── SALARY ─────────────────────────────────────────────────────────────────
export const salaryApi = {
  getAll: () => api.get('/api/salary/all'),
  getMy: () => api.get('/api/salary/my'),
  getAdminMonthly: (year, month) => api.get('/api/salary/admin/monthly', { params: { year, month } }),
}

// ── FOOD HUT ───────────────────────────────────────────────────────────────
export const foodhutApi = {
  getItems: () => api.get('/api/items'),
  getSalesForDay: (date) => api.get('/api/sales/day', { params: { date } }),
  getSummary: (date) => api.get('/api/sales/day/summary', { params: { date } }),
  recordSale: (data) => api.post('/api/sales', data),
  updateSale: (id, data) => api.put(`/api/sales/${id}`, data),
  deleteSale: (id) => api.delete(`/api/sales/${id}`),
}

// ── REPORTS ────────────────────────────────────────────────────────────────
export const reportApi = {
  getAttendance: (params) => api.get('/api/reports/attendance', { params }),
  getSalary: (params) => api.get('/api/reports/salary', { params }),
}

// ── AUDIT LOGS ─────────────────────────────────────────────────────────────
export const auditApi = {
  getAll: () => api.get('/api/audit-logs'),
  getByDate: (date) => api.get('/api/audit-logs/by-date', { params: { date } }),
  getByUser: (userId) => api.get(`/api/audit-logs/user/${userId}`),
  getByEntity: (entityType, entityId) => api.get(`/api/audit-logs/entity/${entityType}/${entityId}`),
  filter: (entityType, action) => api.get('/api/audit-logs/filter', { params: { entityType, action } }),
}

// ── EXPENSE TYPES ──────────────────────────────────────────────────────────────
export const expenseTypeApi = {
  getAll: () => api.get('/api/expense-types'),
  create: (data) => api.post('/api/expense-types', data),
  delete: (id) => api.delete(`/api/expense-types/${id}`),
}

// ── ADMIN CASH TRANSACTIONS (SuperAdmin edit/delete) ───────────────────────────
export const adminTransactionApi = {
  update: (id, data) => api.put(`/api/admin/transactions/${id}`, data),
  delete: (id) => api.delete(`/api/admin/transactions/${id}`),
}

// ── USERS ──────────────────────────────────────────────────────────────────
export const userApi = {
  getAll: () => api.get('/api/users'),
  update: (id, data) => api.put(`/api/users/${id}`, data),
  delete: (id) => api.delete(`/api/users/${id}`),
}

export default api

