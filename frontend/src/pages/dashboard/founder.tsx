import { useTranslation } from 'react-i18next'
import { TrendingUp, CheckSquare, Calendar, ListTodo, ArrowUpRight, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string
  sub?: string
  icon: LucideIcon
  accent: string
  trend?: string
  trendUp?: boolean
}

function StatCard({ label, value, sub, icon: Icon, accent, trend, trendUp }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-glass-border bg-glass backdrop-blur-xl p-5 space-y-4 hover:bg-glass-2 hover:border-glass-border transition-all duration-200">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-ink/40 uppercase tracking-wide">{label}</p>
        <div
          className="h-8 w-8 rounded-xl flex items-center justify-center"
          style={{ background: `${accent}20`, border: `1px solid ${accent}35` }}
        >
          <Icon className="h-4 w-4" style={{ color: accent }} />
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold text-ink tracking-tight">{value}</p>
        {sub && <p className="text-xs text-ink/30 mt-1">{sub}</p>}
      </div>
      {trend && (
        <p className={cn('text-xs flex items-center gap-1', trendUp ? 'text-emerald-400' : 'text-ink/30')}>
          {trendUp && <ArrowUpRight className="h-3 w-3" />}
          {trend}
        </p>
      )}
    </div>
  )
}

const PILLARS = [
  { id: 'productTech', pct: 72, color: 'oklch(0.65 0.22 265)' },
  { id: 'goToMarket', pct: 55, color: 'oklch(0.65 0.20 200)' },
  { id: 'financeOps', pct: 40, color: 'oklch(0.65 0.22 30)' },
  { id: 'teamCulture', pct: 85, color: 'oklch(0.70 0.18 145)' },
  { id: 'legalIp', pct: 30, color: 'oklch(0.65 0.22 310)' },
]

const UPCOMING_EVENTS = [
  { id: 'mentorCheckIn', color: 'oklch(0.65 0.22 265)' },
  { id: 'cohortSession', color: 'oklch(0.65 0.20 200)' },
]

export default function FounderDashboard() {
  const { t } = useTranslation('dashboardFounder')
  const { user } = useAuth()
  const firstName = user?.name?.split(' ')[0]

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Greeting */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-ink">
          {firstName ? t('greeting.welcomeName', { name: firstName }) : t('greeting.welcome')} 👋
        </h1>
        <p className="text-sm text-ink/35">
          {t('greeting.subtitle')}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label={t('stats.readinessScore')}
          value="7.4"
          sub={t('stats.readinessScoreSub')}
          icon={TrendingUp}
          accent="oklch(0.65 0.22 265)"
          trend={t('stats.readinessScoreTrend')}
          trendUp
        />
        <StatCard
          label={t('stats.pillarsDone')}
          value="3 / 8"
          sub={t('stats.pillarsDoneSub')}
          icon={CheckSquare}
          accent="oklch(0.65 0.20 200)"
        />
        <StatCard
          label={t('stats.daysInProgram')}
          value="42"
          sub={t('stats.daysInProgramSub')}
          icon={Calendar}
          accent="oklch(0.65 0.22 310)"
        />
        <StatCard
          label={t('stats.openActions')}
          value="5"
          sub={t('stats.openActionsSub')}
          icon={ListTodo}
          accent="oklch(0.70 0.20 30)"
        />
      </div>

      {/* Main content row */}
      <div className="grid lg:grid-cols-5 gap-4">

        {/* Pillar progress — wider */}
        <div className="lg:col-span-3 rounded-2xl border border-glass-border bg-glass backdrop-blur-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">{t('pillarProgress.title')}</h2>
            <span className="text-xs text-ink/30">{t('pillarProgress.tracked')}</span>
          </div>
          <div className="space-y-4">
            {PILLARS.map((p) => (
              <div key={p.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink/70 font-medium text-xs">{t(`pillars.${p.id}`)}</span>
                  <span className="text-xs font-semibold" style={{ color: p.color }}>{p.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-glass-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${p.pct}%`, background: `${p.color}` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4">

          {/* Score ring card */}
          <div className="rounded-2xl border border-glass-border bg-glass backdrop-blur-xl p-6 flex flex-col items-center text-center space-y-3">
            <p className="text-xs font-medium text-ink/35 uppercase tracking-wide">{t('scoreRing.title')}</p>
            <div className="relative h-24 w-24">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--glass-bd)" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="40" fill="none"
                  stroke="oklch(0.65 0.22 265)"
                  strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 40 * 0.74} ${2 * Math.PI * 40}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-ink">74<span className="text-sm text-ink/40">%</span></span>
              </div>
            </div>
            <p className="text-xs text-ink/30 leading-relaxed">{t('scoreRing.performanceLine1')}<br/>{t('scoreRing.performanceLine2')}</p>
          </div>

          {/* Upcoming placeholder */}
          <div className="rounded-2xl border border-glass-border bg-glass backdrop-blur-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-ink">{t('upcoming.title')}</h2>
            <div className="space-y-2">
              {UPCOMING_EVENTS.map((e) => (
                <div key={e.id} className="flex items-center gap-3 rounded-lg border border-glass-border bg-glass px-3 py-2">
                  <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: e.color }} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-ink/70 truncate">{t(`upcoming.${e.id}`)}</p>
                    <p className="text-[10px] text-ink/30">{t(`upcoming.${e.id}Time`)}</p>
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-ink/20 text-center pt-1">{t('upcoming.empty')}</p>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom row */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-glass-border bg-glass backdrop-blur-xl p-6">
          <h2 className="text-sm font-semibold text-ink mb-3">{t('recentDocuments.title')}</h2>
          <p className="text-xs text-ink/30">{t('recentDocuments.empty')}</p>
        </div>
        <div className="rounded-2xl border border-glass-border bg-glass backdrop-blur-xl p-6">
          <h2 className="text-sm font-semibold text-ink mb-3">{t('activityFeed.title')}</h2>
          <p className="text-xs text-ink/30">{t('activityFeed.empty')}</p>
        </div>
      </div>

    </div>
  )
}
