import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/auth-context'
import { ThemeProvider } from '@/context/theme-context'
import { TenantSlugProvider, useTenantSlug } from '@/context/tenant-slug-context'
import { classifyHost } from '@/lib/host'
import { Toaster } from 'sonner'
import { AppShell } from '@/components/layout/app-shell'
import LandingPage from '@/pages/landing'
import LoginPage from '@/pages/login'
import GetStartedPage from '@/pages/get-started'
import AcceptInvitePage from '@/pages/accept-invite'
import DashboardPage from '@/pages/dashboard'
import CompaniesPage from '@/pages/dashboard/companies'
import PlansBillingPage from '@/pages/dashboard/superadmin/plans'
import CouponsPage from '@/pages/dashboard/superadmin/coupons'
import ReportsPage from '@/pages/dashboard/superadmin/reports'
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

/** Apex/marketing host — example.com, localhost:5173 in dev. */
function ApexRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/get-started" element={<GetStartedPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

/** Super-admin host — admin.example.com, admin.localhost:5173 in dev. */
function AdminRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="superadmin/plans" element={<PlansBillingPage />} />
        <Route path="superadmin/coupons" element={<CouponsPage />} />
        <Route path="superadmin/reports" element={<ReportsPage />} />
        <Route path="superadmin/tenants" element={<TenantsAdminPage />} />
        <Route path="superadmin/admins" element={<SuperAdminsPage />} />
        <Route path="superadmin/settings" element={<SettingsPage />} />
        <Route path="*" element={<ComingSoon />} />
      </Route>
    </Routes>
  )
}

/** Tenant host — {slug}.example.com, {slug}.localhost:5173 in dev. Same
 * shared AppShell/DashboardPage as the admin host — DashboardPage dispatches
 * founder/admin/mentor content by role (see pages/dashboard/index.tsx). */
function TenantRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />
      <Route path="/" element={<TenantScopedApp />}>
        <Route index element={<DashboardPage />} />
        <Route path="companies" element={<CompaniesPage />} />
        <Route path="*" element={<ComingSoon />} />
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

/** Confirms the subdomain maps to a real tenant before the auth gate runs. */
function TenantScopedApp() {
  return (
    <TenantSlugProvider>
      <TenantGate />
    </TenantSlugProvider>
  )
}

function TenantGate() {
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
  return <ProtectedLayout />
}

function HostRouter() {
  const host = classifyHost(window.location.hostname, import.meta.env.VITE_BASE_DOMAIN)
  if (host.kind === 'admin') return <AdminRoutes />
  if (host.kind === 'tenant') return <TenantRoutes />
  return <ApexRoutes />
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <HostRouter />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </ThemeProvider>
  )
}
