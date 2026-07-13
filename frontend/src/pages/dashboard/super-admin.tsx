import { useQuery } from '@tanstack/react-query'
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

function statusLabel(tenant: Tenant) {
  if (tenant.suspended) return 'Suspended'
  if (!tenant.subscription) return 'Trial'
  if (tenant.subscription.status === 'active') return 'Active'
  if (tenant.subscription.status === 'trialing') return 'Trial'
  if (tenant.subscription.status === 'past_due') return 'Past due'
  if (tenant.subscription.status === 'canceled') return 'Canceled'
  return 'Expired'
}

function statusColor(label: string) {
  if (label === 'Active') return 'text-green-600'
  if (label === 'Trial') return 'text-amber-600'
  return 'text-muted-foreground'
}

export default function SuperAdminDashboard() {
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
        <h1 className="text-2xl font-bold">Platform Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Cross-tenant health and usage at a glance.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Tenants" value={stats ? String(stats.tenants) : '—'} icon={Building2} />
        <StatCard
          label="Total Companies"
          value={stats?.totalCompanies == null ? '—' : String(stats.totalCompanies)}
          sub={stats?.totalCompanies == null ? 'Not tracked yet' : undefined}
          icon={Users}
        />
        <StatCard
          label="Avg Platform Score"
          value={stats?.avgPlatformScore == null ? '—' : stats.avgPlatformScore.toFixed(1)}
          sub={stats?.avgPlatformScore == null ? 'Not tracked yet' : undefined}
          icon={TrendingUp}
        />
        <StatCard
          label="MRR"
          value={stats ? `$${(stats.mrrCents / 100).toLocaleString()}` : '—'}
          sub={stats ? `${stats.activeSubscriptions} active subs` : undefined}
          icon={CreditCard}
        />
      </div>

      {/* Tenants table */}
      <div className="rounded-xl border bg-card">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold">Tenants</h2>
        </div>
        <div className="divide-y">
          {tenants.map((tenant) => {
            const label = statusLabel(tenant)
            return (
              <div key={tenant.id} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                    {tenant.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{tenant.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {tenant.foundersUsed} founder{tenant.foundersUsed === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-medium">
                    {tenant.plan?.name ?? 'No plan'}
                  </span>
                  <span className={cn('text-xs font-medium', statusColor(label))}>{label}</span>
                </div>
              </div>
            )
          })}
          {tenants.length === 0 && (
            <div className="px-6 py-6 text-center text-sm text-muted-foreground">No tenants yet.</div>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <h2 className="font-semibold mb-2">Usage & Billing</h2>
        <p className="text-sm text-muted-foreground">
          Manage plans, pricing, and tenant subscriptions on the{' '}
          <a href="/app/superadmin/plans" className="underline underline-offset-2">
            Plans &amp; Billing
          </a>{' '}
          page.
        </p>
      </div>
    </div>
  )
}
