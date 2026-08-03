import { useTranslation } from 'react-i18next'
import { Outlet, useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Eye, X, BookOpen, Users, FileText, Calendar, ShieldCheck } from 'lucide-react'
import { api } from '@/lib/api'
import { ViewAsCompanyProvider } from '@/context/view-as-context'
import { Loader } from '@/components/ui/loader'

interface ViewAsCompanyInfo {
  id: number
  name: string | null
  founderName: string | null
  cohortId: number | null
}

export function PreviewAppShell() {
  const { t } = useTranslation('common')
  const { companyId } = useParams<{ companyId: string }>()
  const navigate = useNavigate()

  const { data: company, isLoading } = useQuery({
    queryKey: ['view-as-company', companyId],
    queryFn: async () => (await api.get<ViewAsCompanyInfo>(`/api/tenants/me/companies/${companyId}/view-as`)).data,
  })

  // Simulated founder items for horizontal preview header
  const previewItems = [
    { title: 'Overview', href: `/companies/${companyId}/view-as-founder`, icon: Eye },
    { title: 'Programs', href: `/companies/${companyId}/view-as-founder/my-programs`, icon: BookOpen },
    { title: 'Team', href: `/companies/${companyId}/view-as-founder/team`, icon: Users },
    { title: 'Documents', href: `/companies/${companyId}/view-as-founder/documents`, icon: FileText },
    { title: 'Calendar', href: `/companies/${companyId}/view-as-founder/calendar`, icon: Calendar },
  ]

  return (
    <div className="relative flex flex-col h-screen overflow-hidden bg-page">
      
      {/* Top Preview Status Banner */}
      <div className="flex items-center justify-between gap-4 px-6 py-3.5 bg-slate-900 text-slate-100 border-b border-slate-800 text-xs shrink-0 z-50 shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-primary/20 text-primary border border-primary/30 rounded-md font-bold uppercase tracking-wider text-[10px]">
            <Eye className="h-3 w-3" /> Preview
          </span>
          <span className="font-semibold text-white">Viewing Workspace As Founder</span>
          <span className="h-3 w-px bg-slate-800" />
          <span className="truncate text-slate-400">
            {company?.founderName ? `${company.founderName} (${company.name})` : 'Loading...'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/companies')}
          className="inline-flex items-center gap-1.5 font-bold text-white hover:text-primary transition-colors text-xs"
        >
          <X className="h-3.5 w-3.5" /> Exit Preview
        </button>
      </div>

      {/* Top Preview Horizontal Navigation Bar */}
      <header className="h-[56px] px-6 bg-card border-b border-border flex items-center justify-between gap-6 shrink-0 z-40">
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm text-foreground tracking-tight">
            {company?.name || 'Company Workspace'}
          </span>
          <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded border border-border">
            Founder Role
          </span>
        </div>
        <nav className="flex items-center gap-1 h-full">
          {previewItems.map((item) => {
            const active = window.location.pathname === item.href
            return (
              <Link
                key={item.title}
                to={item.href}
                className={`relative flex items-center h-[56px] px-4 text-xs font-semibold transition-all border-b-2 ${
                  active
                    ? 'text-primary border-primary bg-primary/[0.02]'
                    : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/30'
                }`}
              >
                <item.icon className="h-3.5 w-3.5 mr-1.5 text-current" />
                {item.title}
              </Link>
            )
          })}
        </nav>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
            {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
      </header>

      {/* Main Workspace content */}
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        {isLoading ? (
          <Loader text={t('loading')} />
        ) : !company ? (
          <p className="text-sm text-muted-foreground">{t('preview.companyNotFound')}</p>
        ) : (
          <ViewAsCompanyProvider value={{ companyId: company.id, companyName: company.name, founderName: company.founderName }}>
            <Outlet />
          </ViewAsCompanyProvider>
        )}
      </main>
    </div>
  )
}
