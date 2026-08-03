import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Lock, CheckCircle2, Circle, Layers } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Pillar } from '@/types/forms'

export default function PillarsPage() {
  const navigate = useNavigate()
  const { t } = useTranslation('founderPillars')

  const { data: pillars = [], isLoading } = useQuery({
    queryKey: ['pillar-progress'],
    queryFn: async () => (await api.get<Pillar[]>('/api/tenants/me/pillar-progress')).data,
  })

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('list.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('list.subtitle')}</p>
      </div>

      {!isLoading && pillars.length === 0 && (
        <div className="surface-card p-8 text-center">
          <Layers className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">{t('list.empty')}</p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {pillars.map((pillar) => {
          const locked = pillar.status === 'locked'
          const completed = pillar.status === 'completed'
          return (
            <button
              key={pillar.pillarNumber}
              disabled={locked}
              onClick={() => navigate(`/pillars/${pillar.pillarNumber}`)}
              className={cn(
                'text-left rounded-xl border p-5 space-y-3 transition-all',
                locked ? 'opacity-50 cursor-not-allowed bg-card' : 'surface-card hover:border-primary/50 cursor-pointer',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{t('list.pillarLabel', { number: pillar.pillarNumber })}</span>
                {locked && <Lock className="h-4 w-4 text-muted-foreground" />}
                {completed && <CheckCircle2 className="h-4 w-4 text-foreground" />}
                {!locked && !completed && <Circle className="h-4 w-4 text-primary" />}
              </div>
              <h3 className="font-semibold">{pillar.title}</h3>
              <div className="space-y-1">
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', completed ? 'bg-foreground' : 'bg-primary')}
                    style={{ width: `${pillar.completionPercentage}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{t('list.percentComplete', { percent: pillar.completionPercentage })}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
