import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { api } from '@/lib/api'
import { consumeHandoffFromLocation } from '@/lib/session-handoff'
import type { AuthUser, AuthTokens, LoginResponse, RegisterResponse } from '@/types/auth'

interface RegisterOrgFields {
  organizationName?: string
  organizationType?: string
  organizationWebsite?: string
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ user: AuthUser; tokens: AuthTokens }>
  logout: () => Promise<void>
  register: (email: string, password: string, name: string, org?: RegisterOrgFields) => Promise<RegisterResponse>
  verifyEmail: (email: string, code: string) => Promise<void>
  adoptSession: (tokens: AuthTokens, user: AuthUser) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const TOKENS_KEY = 'aos_tokens'
const USER_KEY = 'aos_user'

export function getStoredTokens(): AuthTokens | null {
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
    const handoff = consumeHandoffFromLocation()
    if (handoff) {
      storeSession(handoff.tokens, handoff.user)
      setUser(handoff.user)
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
      setLoading(false)
      return
    }

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
    return { user: dbUser, tokens }
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
    const { data } = await api.post<RegisterResponse>('/auth/register', { email, password, name, ...org })
    return data
  }

  async function verifyEmail(email: string, code: string) {
    await api.post('/auth/verify-email', { email, code })
  }

  /** Adopts a session whose tokens were minted server-side (e.g. invite acceptance) without a separate login call. */
  function adoptSession(tokens: AuthTokens, adoptedUser: AuthUser) {
    storeSession(tokens, adoptedUser)
    setUser(adoptedUser)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, verifyEmail, adoptSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
