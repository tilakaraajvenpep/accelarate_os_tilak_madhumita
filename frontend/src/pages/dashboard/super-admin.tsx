import { useQuery } from '@tanstack/react-query'
import { Building2, Users, TrendingUp, CreditCard, type LucideIcon } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/i18n/I18nProvider'
import type { PlatformStats, Tenant } from '@/types/billing'

interface StatCardProps {
  label: string
  value: string
  sub?: string
  icon: LucideIcon
}

function StatCard({ label, value, sub, icon: Icon }: StatCardProps) {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function statusKey(tenant: Tenant): string {
  if (tenant.suspended) return 'dashboard.superAdmin.status.suspended'
  if (!tenant.subscription) return 'dashboard.superAdmin.status.trial'
  if (tenant.subscription.status === 'active') return 'dashboard.superAdmin.status.active'
  if (tenant.subscription.status === 'trialing') return 'dashboard.superAdmin.status.trial'
  if (tenant.subscription.status === 'past_due') return 'dashboard.superAdmin.status.pastDue'
  if (tenant.subscription.status === 'canceled') return 'dashboard.superAdmin.status.canceled'
  return 'dashboard.superAdmin.status.expired'
}

function statusColor(key: string) {
  if (key === 'dashboard.superAdmin.status.active') return 'text-green-600'
  if (key === 'dashboard.superAdmin.status.trial') return 'text-amber-600'
  return 'text-muted-foreground'
}

export default function SuperAdminDashboard() {
  const { t } = useTranslation()

  const { data: stats } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: async () => (await api.get<PlatformStats>('/api/platform/stats')).data,
  })

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => (await api.get<Tenant[]>('/api/tenants')).data,
  })

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t('dashboard.superAdmin.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t('dashboard.superAdmin.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('dashboard.superAdmin.tenants')} value={stats ? String(stats.tenants) : '—'} icon={Building2} />
        <StatCard
          label={t('dashboard.superAdmin.totalCompanies')}
          value={stats?.totalCompanies == null ? '—' : String(stats.totalCompanies)}
          sub={stats?.totalCompanies == null ? t('dashboard.superAdmin.notTrackedYet') : undefined}
          icon={Users}
        />
        <StatCard
          label={t('dashboard.superAdmin.avgPlatformScore')}
          value={stats?.avgPlatformScore == null ? '—' : stats.avgPlatformScore.toFixed(1)}
          sub={stats?.avgPlatformScore == null ? t('dashboard.superAdmin.notTrackedYet') : undefined}
          icon={TrendingUp}
        />
        <StatCard
          label={t('dashboard.superAdmin.mrr')}
          value={stats ? `$${(stats.mrrCents / 100).toLocaleString()}` : '—'}
          sub={stats ? t('dashboard.superAdmin.activeSubs', { count: stats.activeSubscriptions }) : undefined}
          icon={CreditCard}
        />
      </div>

      {/* Tenants table */}
      <div className="rounded-xl border bg-card">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold">{t('dashboard.superAdmin.tenantsTableTitle')}</h2>
        </div>
        <div className="divide-y">
          {tenants.map((tenant) => {
            const key = statusKey(tenant)
            return (
              <div key={tenant.id} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                    {tenant.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{tenant.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {tenant.foundersUsed} {tenant.foundersUsed === 1 ? t('dashboard.superAdmin.founder') : t('dashboard.superAdmin.founders')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-medium">
                    {tenant.plan?.name ?? t('dashboard.superAdmin.noPlan')}
                  </span>
                  <span className={cn('text-xs font-medium', statusColor(key))}>{t(key)}</span>
                </div>
              </div>
            )
          })}
          {tenants.length === 0 && (
            <div className="px-6 py-6 text-center text-sm text-muted-foreground">{t('dashboard.superAdmin.noTenantsYet')}</div>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <h2 className="font-semibold mb-2">{t('dashboard.superAdmin.usageBilling')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('dashboard.superAdmin.usageBillingPrefix')}
          <a href="/app/superadmin/plans" className="underline underline-offset-2">
            {t('dashboard.superAdmin.plansAndBillingLink')}
          </a>
          {t('dashboard.superAdmin.usageBillingSuffix')}
        </p>
      </div>
    </div>
  )
}
