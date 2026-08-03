import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/auth-context'
import { ThemeProvider } from '@/context/theme-context'
import { TenantSlugProvider, useTenantSlug } from '@/context/tenant-slug-context'
import { ChatProvider } from '@/context/chat-context'
import { classifyHost } from '@/lib/host'
import { Toaster } from 'sonner'
import { ConfirmDialogProvider } from '@/components/confirm-dialog'
import { AppShell } from '@/components/layout/app-shell'
import { PreviewAppShell } from '@/components/layout/preview-app-shell'
import { Loader } from '@/components/ui/loader'
import LandingPage from '@/pages/landing'
import LoginPage from '@/pages/login'
import GetStartedPage from '@/pages/get-started'
import AcceptInvitePage from '@/pages/accept-invite'
import AcceptCompanyInvitePage from '@/pages/accept-company-invite'
import AcceptMentorInvitePage from '@/pages/accept-mentor-invite'
import DashboardPage from '@/pages/dashboard'
import CompaniesPage from '@/pages/dashboard/companies'
import FormBuilderPage from '@/pages/dashboard/form-builder'
import CompanyTeamPage from '@/pages/dashboard/company-team'
import PillarsPage from '@/pages/founder/pillars'
import PillarDetailPage from '@/pages/founder/pillar-detail'
import AssignedProgramsPage from '@/pages/founder/assigned-programs'
import CohortsPage from '@/pages/dashboard/cohorts'
import ProgramsPage from '@/pages/dashboard/setup/programs'
import FormsPage from '@/pages/dashboard/setup/forms'
import CalendarPage from '@/pages/dashboard/calendar'
import PlansBillingPage from '@/pages/dashboard/superadmin/plans'
import CouponsPage from '@/pages/dashboard/superadmin/coupons'
import ReportsPage from '@/pages/dashboard/superadmin/reports'
import TenantsAdminPage from '@/pages/dashboard/superadmin/tenants'
import SuperAdminsPage from '@/pages/dashboard/superadmin/admins'
import SettingsPage from '@/pages/dashboard/superadmin/settings'
import TenantSettingsPage from '@/pages/dashboard/settings'
import MentorsPage from '@/pages/mentors'
import MentorAssignmentsPage from '@/pages/mentor/assignments'
import MentorProgramsPage from '@/pages/mentor/programs'
import MentorCohortsPage from '@/pages/mentor/cohorts'
import SubmittedAnswersPage from '@/pages/dashboard/submitted-answers'
import DocumentsPage from '@/pages/dashboard/documents'
import FounderDashboard from '@/pages/dashboard/founder'
import ProfilePage from '@/pages/profile'
import GovernancePage from '@/pages/founder/governance'
import GovernanceConfigsPage from '@/pages/dashboard/governance-configs'
import GovernanceReviewPage from '@/pages/dashboard/governance-review'

function ProtectedLayout() {
  const { user, loading } = useAuth()
  if (loading) {
    return <Loader fullscreen variant="primary" size="lg" text="Loading your workspace..." />
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
        <Route path="profile" element={<ProfilePage />} />
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
      <Route path="/accept-company-invite" element={<AcceptCompanyInvitePage />} />
      <Route path="/accept-mentor-invite" element={<AcceptMentorInvitePage />} />
      <Route path="/" element={<TenantScopedApp />}>
        <Route index element={<DashboardPage />} />
        <Route path="companies" element={<CompaniesPage />} />
        <Route path="cohorts" element={<CohortsPage />} />
        <Route path="setup/programs" element={<ProgramsPage />} />
        <Route path="setup/form" element={<FormsPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="setup/assessment-forms" element={<FormBuilderPage />} />
        <Route path="setup/assessment-forms/:id" element={<FormBuilderPage />} />
        <Route path="pillars" element={<PillarsPage />} />
        <Route path="pillars/:pillarNumber" element={<PillarDetailPage />} />
        <Route path="my-programs" element={<AssignedProgramsPage />} />
        <Route path="governance" element={<GovernancePage />} />
        <Route path="admin/governance/configs" element={<GovernanceConfigsPage />} />
        <Route path="admin/governance/review" element={<GovernanceReviewPage />} />
        <Route path="mentor/governance/review" element={<GovernanceReviewPage />} />
        <Route path="settings" element={<TenantSettingsPage />} />
        <Route path="mentors" element={<MentorsPage />} />
        <Route path="mentor/assignments" element={<MentorAssignmentsPage />} />
        <Route path="mentor/programs" element={<MentorProgramsPage />} />
        <Route path="mentor/cohorts" element={<MentorCohortsPage />} />
        <Route path="admin/submitted-answers" element={<SubmittedAnswersPage />} />
        <Route path="mentor/submitted-answers" element={<SubmittedAnswersPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="team" element={<CompanyTeamPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="*" element={<ComingSoon />} />
      </Route>
      <Route path="/companies/:companyId/view-as-founder" element={<PreviewTenantGate />}>
        <Route index element={<FounderDashboard />} />
        <Route path="my-programs" element={<AssignedProgramsPage />} />
        <Route path="team" element={<CompanyTeamPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="*" element={<PreviewNotAvailable />} />
      </Route>
    </Routes>
  )
}

/** Same tenant + auth gate as TenantGate/ProtectedLayout, but renders PreviewAppShell instead of the
 * normal AppShell, and only ever for an admin (a founder/mentor hitting this URL is bounced home). */
function PreviewTenantGate() {
  return (
    <TenantSlugProvider>
      <PreviewAuthGate />
    </TenantSlugProvider>
  )
}

function PreviewAuthGate() {
  const { tenant, loading: tenantLoading } = useTenantSlug()
  const { user, loading: authLoading } = useAuth()

  if (tenantLoading || authLoading) {
    return <Loader fullscreen variant="primary" size="lg" text="Loading preview..." />
  }
  if (!tenant) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground text-sm">
        Tenant not found.
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/" replace />
  return <PreviewAppShell />
}

function PreviewNotAvailable() {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-lg text-muted-foreground font-medium">This feature isn't available in preview mode yet.</p>
    </div>
  )
}

function ComingSoon() {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-lg text-muted-foreground font-medium">This page is coming soon.</p>
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
    return <Loader fullscreen variant="primary" size="lg" text="Loading organization..." />
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
        <ConfirmDialogProvider>
          <ChatProvider>
            <HostRouter />
            <Toaster position="top-center" richColors />
          </ChatProvider>
        </ConfirmDialogProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
