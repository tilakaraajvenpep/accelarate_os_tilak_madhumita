import { Building2, Users, TrendingUp, CreditCard, ArrowUpRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string
  sub?: string
  icon: LucideIcon
  trend?: string
  trendUp?: boolean
}

function StatCard({ label, value, sub, icon: Icon, trend, trendUp }: StatCardProps) {
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
      {trend && (
        <p className={cn('text-xs flex items-center gap-1', trendUp ? 'text-green-600' : 'text-muted-foreground')}>
          {trendUp && <ArrowUpRight className="h-3 w-3" />}
          {trend}
        </p>
      )}
    </div>
  )
}

const TENANTS = [
  { name: 'NWF Accelerator', plan: 'Pro', companies: 24, status: 'Active' },
  { name: 'Velocity Labs', plan: 'Starter', companies: 8, status: 'Active' },
  { name: 'Apex Incubator', plan: 'Pro', companies: 19, status: 'Trial' },
]

export default function SuperAdminDashboard() {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Platform Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Cross-tenant health and usage at a glance.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Tenants" value="3" sub="2 on Pro plan" icon={Building2} />
        <StatCard label="Total Companies" value="51" icon={Users} trend="+4 this month" trendUp />
        <StatCard label="Avg Platform Score" value="7.3" icon={TrendingUp} trend="+0.2" trendUp />
        <StatCard label="MRR" value="$4,200" sub="3 active subs" icon={CreditCard} trend="+12%" trendUp />
      </div>

      {/* Tenants table */}
      <div className="rounded-xl border bg-card">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold">Tenants</h2>
        </div>
        <div className="divide-y">
          {TENANTS.map((t) => (
            <div key={t.name} className="flex items-center justify-between px-6 py-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                  {t.name[0]}
                </div>
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.companies} companies</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-medium">
                  {t.plan}
                </span>
                <span
                  className={cn(
                    'text-xs font-medium',
                    t.status === 'Active' ? 'text-green-600' : 'text-amber-600',
                  )}
                >
                  {t.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <h2 className="font-semibold mb-2">Usage & Billing</h2>
        <p className="text-sm text-muted-foreground">
          Detailed billing reports and usage analytics coming soon.
        </p>
      </div>
    </div>
  )
}
