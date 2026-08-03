import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Layers, Users } from 'lucide-react'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Loader } from '@/components/ui/loader'

interface MentorAssignment {
  cohortId: number
  cohortName: string
  pillarId: number
  pillarTitle: string
}

interface MentorCohortCompany {
  id: string
  name: string | null
  founderName: string | null
}

export default function MentorAssignmentsPage() {
  const { t } = useTranslation('mentors')

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['mentor-assignments'],
    queryFn: async () => (await api.get<MentorAssignment[]>('/api/tenants/me/mentor/assignments')).data,
  })

  const byCohort = new Map<number, { cohortName: string; pillars: MentorAssignment[] }>()
  for (const a of assignments) {
    if (!byCohort.has(a.cohortId)) byCohort.set(a.cohortId, { cohortName: a.cohortName, pillars: [] })
    byCohort.get(a.cohortId)!.pillars.push(a)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('assignments.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('assignments.subtitle')}</p>
      </div>

      {isLoading ? (
        <Loader />
      ) : byCohort.size === 0 ? (
        <div className="surface-card p-10 text-center">
          <Layers className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{t('assignments.empty')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {[...byCohort.entries()].map(([cohortId, group]) => (
            <div key={cohortId} className="surface-card p-5 space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <h2 className="font-semibold">{group.cohortName}</h2>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {group.pillars.map((p) => (
                    <Badge key={p.pillarId} variant="outline" className="gap-1">
                      <Layers className="h-3 w-3" /> {p.pillarTitle}
                    </Badge>
                  ))}
                </div>
              </div>
              <MentorCohortCompanies cohortId={cohortId} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MentorCohortCompanies({ cohortId }: { cohortId: number }) {
  const { t } = useTranslation('mentors')

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['mentor-cohort-companies', cohortId],
    queryFn: async () => (await api.get<MentorCohortCompany[]>(`/api/tenants/me/mentor/cohorts/${cohortId}/companies`)).data,
  })

  if (isLoading) return <Loader size="sm" />
  if (companies.length === 0) return <p className="text-sm text-muted-foreground">{t('assignments.noCompanies')}</p>

  return (
    <div className="border-t pt-3 space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('assignments.companiesTitle')}</p>
      {companies.map((c) => (
        <div key={c.id} className="rounded-lg border px-3 py-2">
          <p className="text-sm font-medium truncate">{c.name ?? t('assignments.pendingCompanyName')}</p>
          <p className="text-xs text-muted-foreground truncate">{c.founderName ?? '—'}</p>
        </div>
      ))}
    </div>
  )
}
