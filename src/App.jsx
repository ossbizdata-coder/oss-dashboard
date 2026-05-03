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

function PrivateRoute({ children }) {
  const { isLoggedIn } = useAuth()
  return isLoggedIn ? children : <Navigate to="/login" replace />
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
            <Route path="foodhut" element={<FoodHutPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="monthly" element={<MonthlyPage />} />
            <Route path="audit-logs" element={<AuditLogsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

