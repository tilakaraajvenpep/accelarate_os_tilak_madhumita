import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/auth-context'
import { ThemeProvider } from '@/context/theme-context'
import { TenantSlugProvider, useTenantSlug } from '@/context/tenant-slug-context'
import { Toaster } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import LandingPage from '@/pages/landing'
import LoginPage from '@/pages/login'
import GetStartedPage from '@/pages/get-started'
import VerifyInvitePage from '@/pages/verify-invite'
import DashboardPage from '@/pages/dashboard'
import PlansBillingPage from '@/pages/dashboard/superadmin/plans'
import TenantsAdminPage from '@/pages/dashboard/superadmin/tenants'
import SuperAdminsPage from '@/pages/dashboard/superadmin/admins'
import SettingsPage from '@/pages/dashboard/superadmin/settings'

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
      <Route path="/verify-invite" element={<VerifyInvitePage />} />

      {/* Protected — all under /app */}
      <Route path="/app" element={<ProtectedLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="superadmin/plans" element={<PlansBillingPage />} />
        <Route path="superadmin/tenants" element={<TenantsAdminPage />} />
        <Route path="superadmin/admins" element={<SuperAdminsPage />} />
        <Route path="superadmin/settings" element={<SettingsPage />} />
        <Route path="*" element={<ComingSoon />} />
      </Route>

      {/* Tenant-scoped, path-based (no real subdomains yet — see tenant-slug-context.tsx) */}
      <Route path="/t/:slug/*" element={<TenantScopedApp />} />

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

function TenantScopedApp() {
  return (
    <TenantSlugProvider>
      <TenantScopedContent />
    </TenantSlugProvider>
  )
}

function TenantScopedContent() {
  const { tenant, loading } = useTenantSlug()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    )
  }
  if (!tenant) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground text-sm">
        Tenant not found.
      </div>
    )
  }
  return (
    <div className="flex h-screen items-center justify-center text-muted-foreground text-sm">
      Welcome to {tenant.name}.
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
