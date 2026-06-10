import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/auth-context'
import { Toaster } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import LoginPage from '@/pages/login'
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
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<DashboardPage />} />
        {/* Stub routes — replace with real pages as you build them */}
        <Route path="/*" element={<ComingSoon />} />
      </Route>
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
    <AuthProvider>
      <AppRoutes />
      <Toaster position="top-right" richColors />
    </AuthProvider>
  )
}
