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
  { name: 'Product & Tech', pct: 72, color: 'oklch(0.65 0.22 265)' },
  { name: 'Go-to-Market', pct: 55, color: 'oklch(0.65 0.20 200)' },
  { name: 'Finance & Ops', pct: 40, color: 'oklch(0.65 0.22 30)' },
  { name: 'Team & Culture', pct: 85, color: 'oklch(0.70 0.18 145)' },
  { name: 'Legal & IP', pct: 30, color: 'oklch(0.65 0.22 310)' },
]

export default function FounderDashboard() {
  const { user } = useAuth()
  const firstName = user?.name?.split(' ')[0]

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Greeting */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-ink">
          {firstName ? `Welcome back, ${firstName}` : 'Welcome back'} 👋
        </h1>
        <p className="text-sm text-ink/35">
          Here's your program overview for today.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Readiness Score"
          value="7.4"
          sub="out of 10"
          icon={TrendingUp}
          accent="oklch(0.65 0.22 265)"
          trend="+0.3 this week"
          trendUp
        />
        <StatCard
          label="Pillars Done"
          value="3 / 8"
          sub="5 in progress"
          icon={CheckSquare}
          accent="oklch(0.65 0.20 200)"
        />
        <StatCard
          label="Days in Program"
          value="42"
          sub="of 90 days"
          icon={Calendar}
          accent="oklch(0.65 0.22 310)"
        />
        <StatCard
          label="Open Actions"
          value="5"
          sub="2 overdue"
          icon={ListTodo}
          accent="oklch(0.70 0.20 30)"
        />
      </div>

      {/* Main content row */}
      <div className="grid lg:grid-cols-5 gap-4">

        {/* Pillar progress — wider */}
        <div className="lg:col-span-3 rounded-2xl border border-glass-border bg-glass backdrop-blur-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Pillar Progress</h2>
            <span className="text-xs text-ink/30">5 pillars tracked</span>
          </div>
          <div className="space-y-4">
            {PILLARS.map((p) => (
              <div key={p.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink/70 font-medium text-xs">{p.name}</span>
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
            <p className="text-xs font-medium text-ink/35 uppercase tracking-wide">Overall Score</p>
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
            <p className="text-xs text-ink/30 leading-relaxed">Performing above average<br/>for your cohort</p>
          </div>

          {/* Upcoming placeholder */}
          <div className="rounded-2xl border border-glass-border bg-glass backdrop-blur-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-ink">Upcoming</h2>
            <div className="space-y-2">
              {[
                { label: 'Mentor check-in', time: 'Tomorrow 10:00 AM', color: 'oklch(0.65 0.22 265)' },
                { label: 'Cohort session', time: 'Thu 2:00 PM', color: 'oklch(0.65 0.20 200)' },
              ].map((e) => (
                <div key={e.label} className="flex items-center gap-3 rounded-lg border border-glass-border bg-glass px-3 py-2">
                  <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: e.color }} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-ink/70 truncate">{e.label}</p>
                    <p className="text-[10px] text-ink/30">{e.time}</p>
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-ink/20 text-center pt-1">Calendar integration coming soon</p>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom row */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-glass-border bg-glass backdrop-blur-xl p-6">
          <h2 className="text-sm font-semibold text-ink mb-3">Recent Documents</h2>
          <p className="text-xs text-ink/30">Document library coming soon.</p>
        </div>
        <div className="rounded-2xl border border-glass-border bg-glass backdrop-blur-xl p-6">
          <h2 className="text-sm font-semibold text-ink mb-3">Activity Feed</h2>
          <p className="text-xs text-ink/30">Activity tracking coming soon.</p>
        </div>
      </div>

    </div>
  )
}
