import axios from 'axios'

// Get the base URL and ensure it has /api appended automatically.
const ENV_URL = import.meta.env.VITE_API_URL || ''
const BASE_URL = `${ENV_URL.replace(/\/$/, '')}/api`

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
  login: (email, password) => api.post('/auth/login', { email, password }),
  getAllUsers: () => api.get('/auth/all-users'),
}

// ── DAILY CASH ───────────────────────────────────────────────────────────
const SHOP_IDS = { CAFE: 1, BOOKSHOP: 2, FOODHUT: 3 }
export const dailyCashApi = {
  getSummary: (shopCode, date) => {
    const shopId = SHOP_IDS[shopCode?.toUpperCase()]
    if (!shopId) return Promise.reject(new Error(`Unknown shop: ${shopCode}`))
    return api.get(`/daily-cash/${shopId}/${date}`)
  },
  getMonthlySummary: (year, month) => api.get(`/daily-cash/monthly/${year}/${month}`),
  getMonthlyExpenses: (year, month) => api.get(`/expenses/monthly`, { params: { year, month } }),
  getMonthlyCredits: (year, month) => api.get(`/credits/monthly`, { params: { year, month } }),
  override: (dailyCashId, data) => api.patch(`/daily-cash/${dailyCashId}/override`, data),
}

// ── TRANSACTIONS ─────────────────────────────────────────────────────────
export const transactionApi = {
  getByDate: (department, date) => api.get('/transactions/by-date', { params: { department, date } }),
  getDepartmentSummary: (department, date) => api.get('/transactions/department-summary', { params: { department, date } }),
  getDepartmentSummaryRange: (department, startDate, endDate) => api.get('/transactions/department-summary', { params: { department, startDate, endDate } }),
  getDailySummary: (department) => api.get('/transactions/daily-summary', { params: { department } }),
  getCashTotal: (department) => api.get('/transactions/department-cash-total', { params: { department } }),
  create: (data) => api.post('/transactions', data),
  update: (id, data) => api.put(`/transactions/${id}`, data),
  delete: (id) => api.delete(`/transactions/${id}`),
}

// ── CREDITS ───────────────────────────────────────────────────────────────
export const creditApi = {
  getAll: () => api.get('/credits'),
  getUnpaidTotal: () => api.get('/credits/outstanding-total'),
  getByShop: (shopCode, date) => api.get('/credits/by-shop', { params: { shopCode, date } }),
  create: (data) => api.post('/credits', data),
  markPaid: (id) => api.patch(`/credits/${id}`, { isPaid: true }),
  delete: (id) => api.delete(`/credits/${id}`),
}

// ── ATTENDANCE ─────────────────────────────────────────────────────────────
export const attendanceApi = {
  getAll: () => api.get('/attendance/all'),
  getToday: () => api.get('/attendance/today'),
}

// ── SALARY ─────────────────────────────────────────────────────────────────
export const salaryApi = {
  getAll: () => api.get('/salary/all'),
  getMy: () => api.get('/salary/my'),
  getAdminMonthly: (year, month) => api.get('/salary/admin/monthly', { params: { year, month } }),
}

// ── AUDIT LOGS ────────────────────────────────────────────────────────────────
export const auditApi = {
  getAll: () => api.get('/audit-logs'),
  getByDate: (date) => api.get('/audit-logs/by-date', { params: { date } }),
  getByUser: (userId) => api.get(`/audit-logs/user/${userId}`),
  getByEntity: (entityType, entityId) => api.get(`/audit-logs/entity/${entityType}/${entityId}`),
  filter: (params) => api.get('/audit-logs/filter', { params }),
}

// ── EXPENSE TYPES ─────────────────────────────────────────────────────────────
export const expenseTypeApi = {
  getAll: (shopType) => api.get('/expenses/types', { params: shopType ? { shopType } : undefined }),
  create: (data) => api.post('/expenses/types', data),
  delete: (id) => api.delete(`/expenses/types/${id}`),
}

// ── ADMIN TRANSACTIONS ────────────────────────────────────────────────────────
export const adminTransactionApi = {
  getById: (id) => api.get(`/admin/transactions/${id}`),
  update: (id, data) => api.put(`/admin/transactions/${id}`, data),
  delete: (id) => api.delete(`/admin/transactions/${id}`),
}

// ── USERS ─────────────────────────────────────────────────────────────────────
export const userApi = {
  getAll: () => api.get('/users'),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
}

// ── FOOD HUT ───────────────────────────────────────────────────────────────
export const foodhutApi = {
  getItems: () => api.get('/items'),
  getSalesForDay: (date) => api.get('/sales/day', { params: { date } }),
  getSummary: (date) => api.get('/sales/day/summary', { params: { date } }),
  recordSale: (data) => api.post('/sales', data),
  updateSale: (id, data) => api.put(`/sales/${id}`, data),
  deleteSale: (id) => api.delete(`/sales/${id}`),
}

export default api
