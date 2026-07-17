import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Building2, Users, TrendingUp, CheckSquare, ArrowUpRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import type { CompanyEntry } from '@/types/company'

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

export default function AdminDashboard() {
  const { t } = useTranslation('dashboardAdmin')

  const { data: companyEntries, isLoading: companiesLoading } = useQuery({
    queryKey: ['company-entries'],
    queryFn: async () => (await api.get<CompanyEntry[]>('/api/tenants/me/companies')).data,
  })
  const activeCompanies = companyEntries?.filter((c) => c.status === 'active') ?? []

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('stats.activeCompanies')} value={companiesLoading ? '—' : String(activeCompanies.length)} icon={Building2} />
        <StatCard label={t('stats.cohorts')} value="—" icon={Users} />
        <StatCard label={t('stats.avgReadiness')} value="—" icon={TrendingUp} />
        <StatCard label={t('stats.completionRate')} value="—" icon={CheckSquare} />
      </div>

      {/* Top companies */}
      <div className="rounded-xl border bg-card">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold">{t('topCompanies.title')}</h2>
        </div>
        {!companiesLoading && activeCompanies.length === 0 ? (
          <div className="px-6 py-4">
            <p className="text-sm text-muted-foreground">{t('topCompanies.empty')}</p>
          </div>
        ) : (
          <div className="divide-y">
            {activeCompanies.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                    {c.name?.[0] ?? '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.founderName}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-6">
          <h2 className="font-semibold mb-3">{t('recentActivity.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('recentActivity.empty')}</p>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <h2 className="font-semibold mb-3">{t('upcomingEvents.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('upcomingEvents.empty')}</p>
        </div>
      </div>
    </div>
  )
}
