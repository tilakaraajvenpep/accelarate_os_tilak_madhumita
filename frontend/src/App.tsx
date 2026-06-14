import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/auth-context'
import { ThemeProvider } from '@/context/theme-context'
import { Toaster } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import LandingPage from '@/pages/landing'
import LoginPage from '@/pages/login'
import GetStartedPage from '@/pages/get-started'
import DashboardPage from '@/pages/dashboard'

function ProtectedLayout() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <AppShell />
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/get-started" element={<GetStartedPage />} />

      {/* Protected — all under /app */}
      <Route path="/app" element={<ProtectedLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="*" element={<ComingSoon />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function ComingSoon() {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
      This page is coming soon.
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </ThemeProvider>
  )
}
