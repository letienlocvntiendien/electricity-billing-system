import React, { createContext, useContext, useState, useCallback } from 'react'
import type { Role } from '@/types/api'
import { authApi } from '@/api/auth'

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

function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem('user')
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadUser)

  const login = useCallback(async (username: string, password: string) => {
    const res = await authApi.login({ username, password })
    localStorage.setItem('accessToken', res.accessToken)
    localStorage.setItem('refreshToken', res.refreshToken)
    const authUser: AuthUser = { username: res.username, fullName: res.fullName, role: res.role }
    localStorage.setItem('user', JSON.stringify(authUser))
    setUser(authUser)
  }, [])

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('refreshToken') ?? ''
    try { await authApi.logout(refreshToken) } catch { /* ignore */ }
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
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

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
