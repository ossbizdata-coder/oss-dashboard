import { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../services/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const name = localStorage.getItem('name')
    const email = localStorage.getItem('email')
    const role = localStorage.getItem('role')
    const userId = Number(localStorage.getItem('userId') || 0)
    if (token) {
      setUser({ name, email, role, userId: Number.isFinite(userId) ? userId : 0 })
      setIsLoggedIn(true)
    }
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    const res = await authApi.login(email, password)
    const data = res.data
    localStorage.setItem('token', data.token)
    localStorage.setItem('email', data.email)
    localStorage.setItem('name', data.name)
    localStorage.setItem('role', data.role)
    localStorage.setItem('userId', data.userId)
    setUser({ name: data.name, email: data.email, role: data.role, userId: Number(data.userId || 0) })
    setIsLoggedIn(true)
    return data
  }

  const logout = () => {
    localStorage.clear()
    setUser(null)
    setIsLoggedIn(false)
  }

  const isSuperAdmin = user?.role === 'SUPERADMIN'
  const isAdmin = user?.role === 'ADMIN' || isSuperAdmin
  const isOwnerUser = Number(user?.userId) === 1
  // Only ADMIN and SUPERADMIN can access this dashboard
  const hasAccess = isAdmin

  return (
    <AuthContext.Provider value={{ user, isLoggedIn, loading, login, logout, isSuperAdmin, isAdmin, isOwnerUser, hasAccess }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
