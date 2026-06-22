import React, { createContext, useContext, useState, useCallback } from 'react'
import type { Role } from '@/types/api'
import { authApi } from '@/api/auth'
import { isTokenExpired } from '@/lib/token'

interface AuthUser {
  username: string
  fullName: string
  role: Role
}

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  isAdmin: boolean
  isAccountant: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

function clearAuthStorage() {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('user')
}

// Restore the session only if a non-expired token is present.
// A stale `user` with a missing/expired token is wiped so the app starts logged-out.
function loadAuth(): AuthUser | null {
  try {
    const token = localStorage.getItem('accessToken')
    const raw = localStorage.getItem('user')
    if (!raw || isTokenExpired(token)) {
      clearAuthStorage()
      return null
    }
    return JSON.parse(raw) as AuthUser
  } catch {
    clearAuthStorage()
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadAuth)

  const login = useCallback(async (username: string, password: string) => {
    const res = await authApi.login({ username, password })
    localStorage.setItem('accessToken', res.accessToken)
    const authUser: AuthUser = { username: res.username, fullName: res.fullName, role: res.role as Role }
    localStorage.setItem('user', JSON.stringify(authUser))
    setUser(authUser)
  }, [])

  const logout = useCallback(async () => {
    try { await authApi.logout() } catch { /* ignore */ }
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken') // clear legacy key if still stored
    localStorage.removeItem('user')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        login,
        logout,
        isAdmin: user?.role === 'ADMIN',
        isAccountant: user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT',
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}