import { Building2, Users, TrendingUp, CheckSquare, ArrowUpRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from '@/i18n/I18nProvider'

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

const TOP_COMPANIES = [
  { name: 'Loopify', score: 8.9, stage: 'Series A', status: 'onTrack' as const },
  { name: 'Veloforge', score: 8.4, stage: 'Seed', status: 'onTrack' as const },
  { name: 'NestWave', score: 7.8, stage: 'Pre-Seed', status: 'atRisk' as const },
  { name: 'Carbonica', score: 7.2, stage: 'Seed', status: 'onTrack' as const },
  { name: 'Prismly', score: 6.5, stage: 'Idea', status: 'atRisk' as const },
]

export default function AdminDashboard() {
  const { t } = useTranslation()

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t('dashboard.admin.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('dashboard.admin.subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('dashboard.admin.activeCompanies')} value="24" sub={t('dashboard.admin.acrossCohorts')} icon={Building2} />
        <StatCard label={t('dashboard.admin.cohorts')} value="3" sub={t('dashboard.admin.startingSoon')} icon={Users} />
        <StatCard label={t('dashboard.admin.avgReadiness')} value="7.1 / 10" icon={TrendingUp} trend={t('dashboard.admin.trendThisMonth')} trendUp />
        <StatCard label={t('dashboard.admin.completionRate')} value="68%" sub={t('dashboard.admin.targetRate')} icon={CheckSquare} />
      </div>

      {/* Top companies */}
      <div className="rounded-xl border bg-card">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold">{t('dashboard.admin.topCompanies')}</h2>
        </div>
        <div className="divide-y">
          {TOP_COMPANIES.map((c) => (
            <div key={c.name} className="flex items-center justify-between px-6 py-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                  {c.name[0]}
                </div>
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.stage}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold tabular-nums">{c.score}</span>
                <Badge variant={c.status === 'onTrack' ? 'default' : 'destructive'} className="text-xs">
                  {c.status === 'onTrack' ? t('dashboard.admin.onTrack') : t('dashboard.admin.atRisk')}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-6">
          <h2 className="font-semibold mb-3">{t('dashboard.admin.recentActivity')}</h2>
          <p className="text-sm text-muted-foreground">{t('dashboard.admin.activityComingSoon')}</p>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <h2 className="font-semibold mb-3">{t('dashboard.admin.upcomingEvents')}</h2>
          <p className="text-sm text-muted-foreground">{t('dashboard.admin.calendarComingSoon')}</p>
        </div>
      </div>
    </div>
  )
}
