import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { api } from '@/lib/api'
import type { AuthUser, AuthTokens, LoginResponse } from '@/types/auth'

interface RegisterOrgFields {
  organizationName?: string
  organizationType?: string
  organizationWebsite?: string
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  register: (email: string, password: string, name: string, org?: RegisterOrgFields) => Promise<void>
  verifyEmail: (email: string, code: string) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const TOKENS_KEY = 'aos_tokens'
const USER_KEY = 'aos_user'

function getStoredTokens(): AuthTokens | null {
  try { return JSON.parse(localStorage.getItem(TOKENS_KEY) ?? 'null') } catch { return null }
}

function storeSession(tokens: AuthTokens, user: AuthUser) {
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens))
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

function clearSession() {
  localStorage.removeItem(TOKENS_KEY)
  localStorage.removeItem(USER_KEY)
}

/** Rough expiry check by decoding ID token header — no crypto needed */
function isTokenFresh(idToken: string): boolean {
  try {
    const parts = idToken.split('.')
    if (parts.length !== 3) return false
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now()
  } catch { return false }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const tokens = getStoredTokens()
    const storedUser = localStorage.getItem(USER_KEY)
    if (tokens?.idToken && storedUser && isTokenFresh(tokens.idToken)) {
      try { setUser(JSON.parse(storedUser)) } catch { clearSession() }
    } else if (tokens || storedUser) {
      clearSession()
    }
    setLoading(false)
  }, [])

  async function login(email: string, password: string) {
    const { data } = await api.post<LoginResponse>('/auth/login', { email, password })
    const { user: dbUser, ...tokens } = data
    storeSession(tokens, dbUser)
    setUser(dbUser)
  }

  async function logout() {
    const tokens = getStoredTokens()
    if (tokens?.accessToken) {
      try { await api.post('/auth/logout', { accessToken: tokens.accessToken }) } catch { /* best effort */ }
    }
    clearSession()
    setUser(null)
  }

  async function register(email: string, password: string, name: string, org?: RegisterOrgFields) {
    await api.post('/auth/register', { email, password, name, ...org })
  }

  async function verifyEmail(email: string, code: string) {
    await api.post('/auth/verify-email', { email, code })
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    await api.post('/auth/change-password', { currentPassword, newPassword })
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, verifyEmail, changePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
