import { TrendingUp, CheckSquare, Calendar, ListTodo, ArrowUpRight, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
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

const PILLARS = [
  { name: 'Product & Tech', pct: 72 },
  { name: 'Go-to-Market', pct: 55 },
  { name: 'Finance & Ops', pct: 40 },
  { name: 'Team & Culture', pct: 85 },
  { name: 'Legal & IP', pct: 30 },
]

export default function FounderDashboard() {
  const { user } = useAuth()
  const firstName = user?.name?.split(' ')[0]

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold">
          {firstName ? `Welcome back, ${firstName}!` : 'Welcome back!'}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Here's your program overview for today.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Readiness Score" value="7.4 / 10" icon={TrendingUp} trend="+0.3 this week" trendUp />
        <StatCard label="Pillars Done" value="3 / 8" sub="5 in progress" icon={CheckSquare} />
        <StatCard label="Days in Program" value="42" sub="of 90" icon={Calendar} />
        <StatCard label="Open Actions" value="5" sub="2 overdue" icon={ListTodo} />
      </div>

      {/* Pillar progress */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h2 className="font-semibold">Pillar Progress</h2>
        <div className="space-y-3">
          {PILLARS.map((p) => (
            <div key={p.name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{p.name}</span>
                <span className="text-muted-foreground">{p.pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${p.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Placeholder sections */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-6">
          <h2 className="font-semibold mb-3">Upcoming</h2>
          <p className="text-sm text-muted-foreground">Calendar integration coming soon.</p>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <h2 className="font-semibold mb-3">Recent Documents</h2>
          <p className="text-sm text-muted-foreground">Document library coming soon.</p>
        </div>
      </div>
    </div>
  )
}
