import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Building2, Plus, Filter, Clock, X, FileText, ChevronRight, Activity, Calendar, User } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { api } from '@/lib/api'
import { Loader } from '@/components/ui/loader'
import type { CompanyEntry } from '@/types/company'
import type { Cohort } from '@/types/cohort'

export default function AdminDashboard() {
  const { user } = useAuth()
  const { t } = useTranslation('dashboardAdmin')
  const [filterCohort, setFilterCohort] = useState<string>('all')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Fetch Cohorts
  const { data: cohorts = [], isLoading: cohortsLoading } = useQuery({
    queryKey: ['cohorts'],
    queryFn: async () => (await api.get<Cohort[]>('/api/tenants/me/cohorts')).data,
  })

  // Fetch Companies
  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ['company-entries'],
    queryFn: async () => (await api.get<CompanyEntry[]>('/api/tenants/me/companies')).data,
  })

  const activeCompanies = companies.filter(c => c.status === 'active')

  const filteredCompanies = activeCompanies.filter(c => {
    if (filterCohort === 'all') return true
    return c.cohortName === filterCohort
  })

  // Mock Activity Feed data
  const activities = [
    { id: 1, type: 'submission', text: 'Sowndar (v1) submitted "Market Sizing" assessment.', time: '10 mins ago' },
    { id: 2, type: 'invite', text: 'New mentor invite sent to Dr. Evelyn Harrison.', time: '1 hour ago' },
    { id: 3, type: 'cohort', text: 'Cohort "SAMPLE" completed Phase 1 setup.', time: '3 hours ago' },
  ]

  // Mock Events data
  const events = [
    { id: 1, title: 'Cohort Q1 Kickoff Meeting', time: 'Tomorrow, 10:00 AM' },
    { id: 2, title: 'Mentor Sync Session', time: 'Aug 5, 2:00 PM' },
  ]

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* ── Executive Command Card ── */}
      <div className="relative overflow-hidden rounded-xl bg-slate-900 text-white p-6 shadow-md border border-slate-800">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle at 100% 100%, white 0%, transparent 60%), radial-gradient(circle at 0% 0%, white 0%, transparent 40%)'
        }} />
        
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/25 border border-primary/45 flex items-center justify-center">
              <User className="h-5 w-5 text-slate-400" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Welcome back</p>
              <h1 className="text-xl font-extrabold text-white leading-tight mt-0.5">
                {user?.name ?? 'Admin'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-800/60 p-2 rounded-xl border border-slate-700/50">
            <div className="px-4 py-1 border-r border-slate-700">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Companies</p>
              <p className="text-2xl font-black text-white mt-0.5">{companiesLoading ? '—' : activeCompanies.length}</p>
            </div>
            <div className="px-4 py-1">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Cohorts Running</p>
              <p className="text-2xl font-black text-white mt-0.5">{cohortsLoading ? '—' : cohorts?.length ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Full-Width Interactive Data Workspace ── */}
      <div className="surface-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-bold text-foreground">{t('topCompanies.title')}</h2>
          </div>
          {!companiesLoading && (
            <span className="text-sm font-semibold px-3 py-1 bg-muted text-muted-foreground rounded-full">
              {filteredCompanies.length} Active
            </span>
          )}
        </div>

        {companiesLoading ? (
          <div className="py-20 flex justify-center"><Loader /></div>
        ) : filteredCompanies.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-base text-muted-foreground font-semibold">{t('topCompanies.empty')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs font-bold text-muted-foreground uppercase tracking-wider text-left">
                  <th className="px-6 py-3.5 w-16 text-center">#</th>
                  <th className="px-6 py-3.5">Company</th>
                  <th className="px-6 py-3.5">Founder</th>
                  <th className="px-6 py-3.5">Cohort</th>
                  <th className="px-6 py-3.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCompanies.map((c, idx) => (
                  <tr key={c.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-6 py-4.5 text-center text-sm font-bold text-muted-foreground/60">{idx + 1}</td>
                    <td className="px-6 py-4.5">
                      <div className="flex items-center gap-3.5">
                        <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center text-sm font-bold text-accent-foreground flex-shrink-0 border border-border">
                          {c.name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <span className="font-bold text-foreground text-base">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4.5 text-muted-foreground font-semibold text-sm">{c.founderName}</td>
                    <td className="px-6 py-4.5 text-muted-foreground text-sm">{c.cohortName ?? '—'}</td>
                    <td className="px-6 py-4.5 text-right">
                      <span className="inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400">
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Contextual Sliding Drawer for Activity & Events ── */}
      {isDrawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 transition-opacity"
            onClick={() => setIsDrawerOpen(false)}
          />

          {/* Drawer Container */}
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-card border-l border-border shadow-xl z-50 flex flex-col animate-slide-in">
            {/* Header */}
            <div className="px-6 py-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-lg text-foreground">Activity Console</h3>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="h-10 w-10 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Contents */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Activity Feed Section */}
              <div className="space-y-4.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4" /> Recent Activities
                </h4>
                <div className="space-y-3">
                  {activities.map((act) => (
                    <div key={act.id} className="p-4 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 transition-colors">
                      <p className="text-sm font-semibold text-foreground leading-relaxed">{act.text}</p>
                      <span className="text-xs text-muted-foreground block mt-1.5">{act.time}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Upcoming Events Section */}
              <div className="space-y-4.5 pt-4 border-t border-border">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Upcoming Events
                </h4>
                <div className="space-y-3">
                  {events.map((evt) => (
                    <div key={evt.id} className="flex items-start gap-3 p-4 rounded-xl border border-border bg-muted/30">
                      <div className="h-9 w-9 rounded-lg bg-accent text-accent-foreground flex items-center justify-center flex-shrink-0">
                        <Calendar className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{evt.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{evt.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4.5 border-t border-border bg-muted/10">
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/95 text-sm font-bold rounded-lg flex items-center justify-center cursor-pointer"
              >
                Close Panel
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  )
}
