import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Building2, Users, TrendingUp, CreditCard, type LucideIcon } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
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

function statusKey(tenant: Tenant) {
  if (tenant.suspended) return 'suspended'
  if (!tenant.subscription) return 'trial'
  if (tenant.subscription.status === 'active') return 'active'
  if (tenant.subscription.status === 'trialing') return 'trial'
  if (tenant.subscription.status === 'past_due') return 'pastDue'
  if (tenant.subscription.status === 'canceled') return 'canceled'
  return 'expired'
}

function statusColor(key: string) {
  if (key === 'active') return 'text-green-600'
  if (key === 'trial') return 'text-amber-600'
  return 'text-muted-foreground'
}

export default function SuperAdminDashboard() {
  const { t } = useTranslation('dashboardSuperAdmin')
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
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t('subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('stats.tenants')} value={stats ? String(stats.tenants) : '—'} icon={Building2} />
        <StatCard
          label={t('stats.totalCompanies')}
          value={stats?.totalCompanies == null ? '—' : String(stats.totalCompanies)}
          sub={stats?.totalCompanies == null ? t('stats.notTrackedYet') : undefined}
          icon={Users}
        />
        <StatCard
          label={t('stats.avgPlatformScore')}
          value={stats?.avgPlatformScore == null ? '—' : stats.avgPlatformScore.toFixed(1)}
          sub={stats?.avgPlatformScore == null ? t('stats.notTrackedYet') : undefined}
          icon={TrendingUp}
        />
        <StatCard
          label={t('stats.mrr')}
          value={stats ? `$${(stats.mrrCents / 100).toLocaleString()}` : '—'}
          sub={stats ? t('stats.activeSubs', { count: stats.activeSubscriptions }) : undefined}
          icon={CreditCard}
        />
      </div>

      {/* Tenants table */}
      <div className="rounded-xl border bg-card">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold">{t('tenantsSection.title')}</h2>
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
                      {t('tenantsSection.founders', { count: tenant.foundersUsed })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-medium">
                    {tenant.plan?.name ?? t('tenantsSection.noPlan')}
                  </span>
                  <span className={cn('text-xs font-medium', statusColor(key))}>{t(`tenantStatus.${key}`)}</span>
                </div>
              </div>
            )
          })}
          {tenants.length === 0 && (
            <div className="px-6 py-6 text-center text-sm text-muted-foreground">{t('tenantsSection.empty')}</div>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <h2 className="font-semibold mb-2">{t('usageBilling.title')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('usageBilling.descriptionPrefix')}{' '}
          <a href="/superadmin/plans" className="underline underline-offset-2">
            {t('usageBilling.plansLink')}
          </a>{' '}
          {t('usageBilling.descriptionSuffix')}
        </p>
      </div>
    </div>
  )
}
