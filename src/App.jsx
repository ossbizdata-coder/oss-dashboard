import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'
import LoginPage from './pages/LoginPage.jsx'
import Layout from './components/Layout.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import ShopsPage from './pages/ShopsPage.jsx'
import ShopDetailPage from './pages/ShopDetailPage.jsx'
import StaffPage from './pages/StaffPage.jsx'
import CreditsPage from './pages/CreditsPage.jsx'
import FoodHutPage from './pages/FoodHutPage.jsx'
import ReportsPage from './pages/ReportsPage.jsx'
import AuditLogsPage from './pages/AuditLogsPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import MonthlyPage from './pages/MonthlyPage.jsx'
import UsersPage from './pages/UsersPage.jsx'
import ExpensesPage from './pages/ExpensesPage.jsx'

function PrivateRoute({ children }) {
  const { isLoggedIn, hasAccess } = useAuth()
  if (!isLoggedIn) return <Navigate to="/login" replace />
  if (!hasAccess) return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 to-primary-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h2>
        <p className="text-gray-500 text-sm mb-6">Your account does not have permission to access this dashboard.</p>
        <button
          onClick={() => { localStorage.clear(); window.location.href = '/login' }}
          className="w-full bg-primary-800 text-white py-2.5 rounded-xl font-medium hover:bg-primary-900 transition-colors"
        >
          Back to Login
        </button>
      </div>
    </div>
  )
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }>
            <Route index element={<DashboardPage />} />
            <Route path="shops" element={<ShopsPage />} />
            <Route path="shops/:shopCode" element={<ShopDetailPage />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="credits" element={<CreditsPage />} />
            <Route path="expenses" element={<ExpensesPage />} />
            <Route path="foodhut" element={<FoodHutPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="monthly" element={<MonthlyPage />} />
            <Route path="audit-logs" element={<AuditLogsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="users" element={<UsersPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

