import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { CheckSquare, CheckCircle2, Sparkles } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { useViewAsCompany } from '@/context/view-as-context'
import { api } from '@/lib/api'
import { Loader } from '@/components/ui/loader'

interface PillarSummary {
  pillarId: number
  title: string
  completed: boolean
}

export default function FounderDashboard() {
  const { t } = useTranslation('dashboardFounder')
  const { user } = useAuth()
  const viewAs = useViewAsCompany()
  const firstName = viewAs ? viewAs.founderName?.split(' ')[0] : user?.name?.split(' ')[0]

  const { data: pillars = [], isLoading: pillarsLoading } = useQuery({
    queryKey: ['founder-pillars-summary', viewAs?.companyId],
    queryFn: async () =>
      (
        await api.get<PillarSummary[]>(
          viewAs
            ? `/api/tenants/me/companies/${viewAs.companyId}/view-as/pillars-summary`
            : '/api/tenants/me/founder/pillars-summary',
        )
      ).data,
  })
  const completedCount = pillars.filter((p) => p.completed).length
  const completePct = pillars.length > 0 ? Math.round((completedCount / pillars.length) * 100) : 0

  return (
    <div className="max-w-7xl mx-auto space-y-6 relative">
      
      {/* ── Executive Command Hero Banner ── */}
      <div className="relative overflow-hidden rounded-xl bg-slate-900 text-white p-6 md:p-8 shadow-md border border-slate-800">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle at 100% 100%, white 0%, transparent 60%), radial-gradient(circle at 0% 0%, white 0%, transparent 40%)'
        }} />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/25 border border-primary/40 text-primary-foreground text-xs font-bold uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5 text-slate-400" /> Founder Console
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              {firstName ? t('greeting.welcomeName', { name: firstName }) : t('greeting.welcome')} 👋
            </h1>
            <p className="text-base text-slate-300 max-w-xl">{t('greeting.subtitle')}</p>
          </div>

          {/* Quick Metrics Inline Pill Widget */}
          {!pillarsLoading && pillars.length > 0 && (
            <div className="flex items-center gap-4 bg-slate-800/60 p-4 rounded-xl border border-slate-700/50 shrink-0">
              <div className="pr-4 border-r border-slate-700">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Completed Pillars</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-2xl font-black text-white">{completedCount}</span>
                  <span className="text-xs text-slate-400 font-bold">/ {pillars.length}</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pillar Progress</p>
                <p className="text-2xl font-black text-slate-300 mt-1">{completePct}%</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Full-Width Program Pillars Table Workspace ── */}
      <div className="surface-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <CheckSquare className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-bold text-foreground">{t('pillarProgress.title')}</h2>
          </div>
          {!pillarsLoading && (
            <span className="text-sm font-semibold px-3 py-1 bg-muted text-muted-foreground rounded-full">
              {pillars.length} Tracked
            </span>
          )}
        </div>

        {pillarsLoading ? (
          <div className="py-20 flex justify-center"><Loader /></div>
        ) : pillars.length === 0 ? (
          <div className="text-center py-20 px-6">
            <CheckSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-base text-muted-foreground font-semibold">{t('pillarProgress.empty')}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {pillars.map((p) => (
              <div key={p.pillarId} className="px-6 py-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                <div className="space-y-1">
                  <span className="text-base font-bold text-foreground">{p.title}</span>
                  <p className="text-sm text-muted-foreground">Pillar {p.pillarId}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-2 rounded-full bg-muted overflow-hidden hidden sm:block">
                    <div
                      className="h-full bg-gradient-accent rounded-full transition-all duration-700"
                      style={{ width: p.completed ? '100%' : '0%' }}
                    />
                  </div>
                  {p.completed ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {t('pillarProgress.completed')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-muted border border-border text-muted-foreground">
                      {t('pillarProgress.inProgress')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
