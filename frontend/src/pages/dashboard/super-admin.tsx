import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Building2, CreditCard, Users, TrendingUp, Sparkles, Shield } from 'lucide-react'
import { api } from '@/lib/api'
import type { PlatformStats, Tenant } from '@/types/billing'

function statusInfo(tenant: Tenant): { label: string; cls: string } {
  if (tenant.suspended) return { label: 'Suspended', cls: 'text-red-800 bg-red-50 border border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800' }
  const s = tenant.subscription?.status
  if (s === 'active') return { label: 'Active', cls: 'text-emerald-800 bg-emerald-50 border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-800' }
  if (s === 'trialing') return { label: 'Trial', cls: 'text-zinc-800 bg-zinc-50 border border-zinc-200 dark:text-zinc-400 dark:bg-zinc-900/20 dark:border-zinc-800' }
  if (s === 'past_due') return { label: 'Past Due', cls: 'text-amber-800 bg-amber-50 border border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-800' }
  if (s === 'canceled') return { label: 'Canceled', cls: 'text-slate-800 bg-slate-100 border border-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-700' }
  return { label: 'No Plan', cls: 'text-slate-700 bg-slate-50 border border-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-700' }
}

export default function SuperAdminDashboard() {
  const { t } = useTranslation('dashboardSuperAdmin')

  const { data: stats } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: async () => (await api.get<PlatformStats>('/api/platform/stats')).data,
  })
  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => (await api.get<Tenant[]>('/api/tenants')).data,
  })

  const filteredTenants = tenants

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* ── Executive Command Hero Banner ── */}
      <div className="relative overflow-hidden rounded-xl bg-slate-900 text-white p-6 md:p-8 shadow-md border border-slate-800">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle at 100% 100%, white 0%, transparent 60%), radial-gradient(circle at 0% 0%, white 0%, transparent 40%)'
        }} />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/25 border border-primary/40 text-primary-foreground text-xs font-bold uppercase tracking-wider">
              <Shield className="h-3.5 w-3.5 text-slate-400" /> Platform Controller
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">{t('title')}</h1>
            <p className="text-base text-slate-300 max-w-xl">{t('subtitle')}</p>
          </div>

          {/* Quick Metrics Inline Pill Widget */}
          <div className="flex flex-wrap items-center gap-3 shrink-0 bg-slate-800/60 p-4 rounded-xl border border-slate-700/50">
            <div className="px-4 py-1 border-r border-slate-700">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Tenants</p>
              <p className="text-2xl font-black text-white mt-0.5">{stats ? String(stats.tenants) : '—'}</p>
            </div>
            <div className="px-4 py-1 border-r border-slate-700">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Platform MRR</p>
              <p className="text-2xl font-black text-white mt-0.5">{stats ? `$${(stats.mrrCents / 100).toLocaleString()}` : '—'}</p>
            </div>
            <div className="px-4 py-1">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Subs</p>
              <p className="text-2xl font-black text-white mt-0.5">{stats ? stats.activeSubscriptions : '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Full-Width Platform tenants list table ── */}
      <div className="surface-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-bold text-foreground">{t('tenantsSection.title')}</h2>
          </div>
        </div>

        {/* Table Content */}
        {filteredTenants.length > 0 ? (
          <div className="overflow-x-auto">
            {/* Header Columns */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3.5 bg-muted/40 border-b border-border text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <span className="col-span-5">{t('tenantsSection.tenantColumn')}</span>
              <span className="col-span-3">{t('tenantsSection.planColumn')}</span>
              <span className="col-span-2 text-center">{t('tenantsSection.statusColumn')}</span>
              <span className="col-span-2 text-right">Founders</span>
            </div>

            {/* List Rows */}
            <div className="divide-y divide-border">
              {filteredTenants.map((tenant) => {
                const { label, cls } = statusInfo(tenant)
                return (
                  <div
                    key={tenant.id}
                    className="grid grid-cols-12 gap-4 items-center px-6 py-4.5 hover:bg-muted/10 transition-colors"
                  >
                    {/* Tenant Info */}
                    <div className="col-span-5 flex items-center gap-3.5 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center text-sm font-bold text-accent-foreground flex-shrink-0 overflow-hidden border border-border shadow-xs">
                        {tenant.logoUrl
                          ? <img src={tenant.logoUrl} alt={tenant.name} className="h-full w-full object-contain" />
                          : tenant.name[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-bold text-foreground truncate">{tenant.name}</p>
                        <p className="text-sm text-muted-foreground">{tenant.slug}</p>
                      </div>
                    </div>

                    {/* Plan */}
                    <div className="col-span-3 text-sm font-semibold text-muted-foreground truncate">
                      {tenant.plan?.name ?? <span className="text-muted-foreground/45">{t('tenantsSection.noPlan')}</span>}
                    </div>

                    {/* Status */}
                    <div className="col-span-2 flex justify-center">
                      <span className={`inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-full ${cls}`}>
                        {label}
                      </span>
                    </div>

                    {/* Founders Limit */}
                    <div className="col-span-2 text-right text-sm font-bold text-muted-foreground">
                      {t('tenantsSection.founders', { count: tenant.foundersUsed })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="px-6 py-20 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-base text-muted-foreground font-semibold">{t('tenantsSection.empty')}</p>
          </div>
        )}
      </div>

    </div>
  )
}
