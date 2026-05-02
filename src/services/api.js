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
  getUnpaidTotal: () => api.get('/api/credits/unpaid-total'),
  create: (data) => api.post('/api/credits', data),
  markPaid: (id) => api.put(`/api/credits/${id}/pay`),
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
}

// ── FOOD HUT ───────────────────────────────────────────────────────────────
export const foodhutApi = {
  getItems: () => api.get('/api/items'),
  getSalesForDay: (date) => api.get('/api/sales/day', { params: { date } }),
  getSummary: (date) => api.get('/api/sales/summary', { params: { date } }),
  recordSale: (data) => api.post('/api/sales', data),
}

// ── REPORTS ────────────────────────────────────────────────────────────────
export const reportApi = {
  getAttendance: (params) => api.get('/api/reports/attendance', { params }),
  getSalary: (params) => api.get('/api/reports/salary', { params }),
}

// ── AUDIT LOGS ─────────────────────────────────────────────────────────────
export const auditApi = {
  getAll: () => api.get('/api/audit-logs'),
}

// ── EXPENSE TYPES ──────────────────────────────────────────────────────────
export const expenseTypeApi = {
  getAll: () => api.get('/api/expense-types'),
  create: (data) => api.post('/api/expense-types', data),
  delete: (id) => api.delete(`/api/expense-types/${id}`),
}

// ── USERS ──────────────────────────────────────────────────────────────────
export const userApi = {
  getAll: () => api.get('/api/users'),
  update: (id, data) => api.put(`/api/users/${id}`, data),
  delete: (id) => api.delete(`/api/users/${id}`),
}

export default api

