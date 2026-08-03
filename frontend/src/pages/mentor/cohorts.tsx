import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Loader } from '@/components/ui/loader'
import type { Cohort } from '@/types/cohort'

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function MentorCohortsPage() {
  const { t } = useTranslation('mentors')

  const { data: cohorts = [], isLoading } = useQuery({
    queryKey: ['mentor-all-cohorts'],
    queryFn: async () => (await api.get<Cohort[]>('/api/tenants/me/mentor/cohorts')).data,
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('allCohorts.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('allCohorts.subtitle')}</p>
      </div>

      {isLoading ? (
        <Loader />
      ) : cohorts.length === 0 ? (
        <div className="surface-card p-10 text-center">
          <Users className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{t('allCohorts.empty')}</p>
        </div>
      ) : (
        <div className="surface-card divide-y overflow-hidden">
          <div className="grid grid-cols-[1fr_250px_100px] gap-4 items-center bg-muted/40 px-6 py-3 text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider border-b">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 shrink-0" />
              <span>{t('allCohorts.cohortInfo')}</span>
            </div>
            <div className="text-center w-[250px] mx-auto">
              <span>{t('allCohorts.assignedPrograms')}</span>
            </div>
            <div className="text-center w-[100px] mx-auto">
              <span>{t('allCohorts.companies')}</span>
            </div>
          </div>
          {cohorts.map((cohort) => (
            <div key={cohort.id} className="grid grid-cols-[1fr_250px_100px] gap-4 items-center px-6 py-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{cohort.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(cohort.startDate)} – {formatDate(cohort.endDate)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 justify-center w-[250px] mx-auto">
                {cohort.assignedPrograms.length === 0 ? (
                  <span className="text-muted-foreground text-xs">—</span>
                ) : (
                  cohort.assignedPrograms.map((p) => (
                    <Badge key={p.id} variant="outline" className="text-[10px] font-normal">{p.name}</Badge>
                  ))
                )}
              </div>
              <div className="flex justify-center w-[100px] mx-auto">
                <Badge variant="secondary" className="gap-1 shrink-0">
                  <Users className="h-3 w-3" /> {cohort.companyCount}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
