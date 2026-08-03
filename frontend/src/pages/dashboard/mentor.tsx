import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Layers, Users, UserPlus, ChevronRight, Sparkles, BookOpen, Clock } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { Loader } from '@/components/ui/loader'
import { api } from '@/lib/api'

interface MentorAssignment {
  cohortId: number
  cohortName: string
  pillarId: number
  pillarTitle: string
}

export default function MentorDashboard() {
  const { user } = useAuth()
  const { t } = useTranslation('mentors')
  const navigate = useNavigate()

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['mentor-assignments'],
    queryFn: async () => (await api.get<MentorAssignment[]>('/api/tenants/me/mentor/assignments')).data,
  })

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader /></div>
  }

  const cohortCount = new Set(assignments.map((a) => a.cohortId)).size

  const actions = [
    { id: 'mentor-view-assignments', icon: Layers, label: t('dashboard.viewAssignments'), to: '/mentor/assignments' },
    { id: 'mentor-view-cohorts', icon: Users, label: t('dashboard.viewAllCohorts'), to: '/mentor/cohorts' },
    { id: 'mentor-invite-mentors', icon: UserPlus, label: t('dashboard.inviteMentors'), to: '/mentors' },
  ]

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
              <Sparkles className="h-3.5 w-3.5 text-slate-400" /> Mentor Dashboard
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              {t('dashboard.greeting', { name: user?.name ?? '' })}
            </h1>
            <p className="text-base text-slate-300 max-w-xl">{t('dashboard.subtitle')}</p>
          </div>

          {/* Quick Metrics Inline Pill Widget */}
          <div className="flex items-center gap-4 bg-slate-800/60 p-4 rounded-xl border border-slate-700/50 shrink-0">
            <div className="pr-4 border-r border-slate-700">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-mono">Active Cohorts</p>
              <p className="text-2xl font-black text-white mt-1 text-center">{cohortCount}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-mono">Assigned Pillars</p>
              <p className="text-2xl font-black text-slate-300 mt-1 text-center">{assignments.length}</p>
            </div>
          </div>
        </div>

        {/* Info detail inside Hero */}
        <div className="mt-6 pt-5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Logged in as Mentor</span>
          <span>{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        </div>
      </div>

      {/* ── Quick Actions / Full Width Workspace ── */}
      <div className="surface-card overflow-hidden">
        <div className="px-6 py-5 border-b border-border bg-card">
          <h2 className="text-lg font-bold text-foreground">Interactive Navigation Console</h2>
        </div>
        <div className="divide-y divide-border">
          {actions.map(({ id, icon: Icon, label, to }) => (
            <button
              key={id}
              id={id}
              type="button"
              onClick={() => navigate(to)}
              className="w-full flex items-center gap-4 px-6 py-4.5 text-left hover:bg-muted/10 transition-colors group cursor-pointer"
            >
              <div className="h-11 w-11 rounded-lg bg-accent flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:text-white transition-colors border border-border">
                <Icon className="h-5 w-5 text-accent-foreground group-hover:text-white" />
              </div>
              <span className="flex-1 text-base font-bold text-foreground group-hover:text-primary transition-colors">{label}</span>
              <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
            </button>
          ))}
        </div>
      </div>

    </div>
  )
}
