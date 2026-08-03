import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import type { Program } from '@/types/program'
import type { Cohort } from '@/types/cohort'

interface CalendarItems {
  pillars: { id: number; title: string }[]
  sections: { id: number; title: string }[]
}

interface EligibleMentor {
  id: number
  name: string | null
  email: string
  specialization: string | null
}

function mentorLabel(mentor: EligibleMentor) {
  const name = mentor.name ?? mentor.email
  return mentor.specialization ? `${name} — ${mentor.specialization}` : name
}

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error
    ?? (err instanceof Error ? err.message : fallback)
}

/**
 * Schedules a program onto a cohort — one date per calendar-enabled pillar/
 * section in that program. Pass exactly one of `program` (shows a cohort
 * picker) or `cohort` (shows a program picker) as the preselected side.
 */
export function AssignProgramToCohortDialog({
  open,
  onOpenChange,
  program,
  cohort,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  program?: Program
  cohort?: Cohort
}) {
  const { t } = useTranslation('program')
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null)
  const [selectedCohortId, setSelectedCohortId] = useState<number | null>(null)
  const [startDate, setStartDate] = useState('')
  const [dates, setDates] = useState<Record<string, string>>({})
  const [pillarMentors, setPillarMentors] = useState<Record<number, number | null>>({})
  const [assignMentors, setAssignMentors] = useState(false)

  const resolvedProgramId = program?.id ?? selectedProgramId
  const resolvedCohortId = cohort?.id ?? selectedCohortId

  const { data: programsList = [] } = useQuery({
    queryKey: ['programs'],
    queryFn: async () => (await api.get<Program[]>('/api/tenants/me/programs')).data,
    enabled: open && !program,
  })

  const { data: cohortsList = [] } = useQuery({
    queryKey: ['cohorts'],
    queryFn: async () => (await api.get<Cohort[]>('/api/tenants/me/cohorts')).data,
    enabled: open && !cohort,
  })

  const { data: calendarItems } = useQuery({
    queryKey: ['program-calendar-items', resolvedProgramId],
    queryFn: async () => (await api.get<CalendarItems>(`/api/tenants/me/programs/${resolvedProgramId}/calendar-items`)).data,
    enabled: open && resolvedProgramId !== null,
  })

  const { data: eligibleMentors = [] } = useQuery({
    queryKey: ['mentors-eligible'],
    queryFn: async () => (await api.get<EligibleMentor[]>('/api/tenants/me/mentors/eligible')).data,
    enabled: open,
  })

  const { data: programPillars = [] } = useQuery({
    queryKey: ['program-pillars-all', resolvedProgramId],
    queryFn: async () => (await api.get<{ id: number; title: string }[]>(`/api/tenants/me/pillars?programId=${resolvedProgramId}`)).data,
    enabled: open && resolvedProgramId !== null,
  })

  function reset() {
    setSelectedProgramId(null)
    setSelectedCohortId(null)
    setStartDate('')
    setDates({})
    setPillarMentors({})
    setAssignMentors(false)
  }

  const items = [
    ...(calendarItems?.pillars.map((p) => ({ type: 'pillar' as const, id: p.id, title: p.title })) ?? []),
    ...(calendarItems?.sections.map((s) => ({ type: 'section' as const, id: s.id, title: s.title })) ?? []),
  ]

  function dateKey(type: 'pillar' | 'section', id: number) {
    return `${type}-${id}`
  }

  const mutation = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/api/tenants/me/programs/${resolvedProgramId}/assign-to-cohort`, {
          cohortId: resolvedCohortId,
          // A pillar/section without its own override just gets the shared start
          // date; if neither is set, its date is simply left null (optional).
          items: items.map((item) => ({ type: item.type, id: item.id, date: dates[dateKey(item.type, item.id)] || startDate || null })),
          pillarMentors: assignMentors
            ? Object.entries(pillarMentors)
                .filter(([, mentorUserId]) => mentorUserId !== null)
                .map(([pillarId, mentorUserId]) => ({ pillarId: Number(pillarId), mentorUserId: mentorUserId as number }))
            : [],
        })
      ).data,
    onSuccess: () => {
      toast.success(t('programs.assignToCohort.toast.assigned'))
      onOpenChange(false)
      reset()
    },
    onError: (err) => toast.error(apiError(err, t('programs.assignToCohort.toast.assignFailed'))),
  })

  // Start date is just a convenience default for calendar-enabled items —
  // never required. A program with no calendar-enabled pillars/sections has
  // nothing to date at all, so it can still be assigned with zero items.
  const formValid = resolvedProgramId !== null && resolvedCohortId !== null

  const dialogTitle = program
    ? t('programs.assignToCohort.dialogTitle', { name: program.name })
    : cohort
      ? t('programs.assignToCohort.dialogTitleForCohort', { name: cohort.name })
      : t('programs.assignToCohort.button')

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{t('programs.assignToCohort.dialogDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          {!program && (
            <div className="space-y-1.5">
              <Label required>{t('programs.assignToCohort.programLabel')}</Label>
              <Select value={selectedProgramId === null ? '' : String(selectedProgramId)} onValueChange={(v) => setSelectedProgramId(v ? Number(v) : null)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string | null) => programsList.find((p) => String(p.id) === value)?.name ?? t('programs.assignToCohort.programPlaceholder')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {programsList.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!cohort && (
            <div className="space-y-1.5">
              <Label required>{t('programs.assignToCohort.cohortLabel')}</Label>
              <Select value={selectedCohortId === null ? '' : String(selectedCohortId)} onValueChange={(v) => setSelectedCohortId(v ? Number(v) : null)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string | null) => cohortsList.find((c) => String(c.id) === value)?.name ?? t('programs.assignToCohort.cohortPlaceholder')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {cohortsList.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cohortsList.length === 0 && <p className="text-xs text-muted-foreground">{t('programs.assignToCohort.noCohorts')}</p>}
            </div>
          )}

          {resolvedProgramId !== null && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="assignMentors"
                  checked={assignMentors}
                  onChange={(e) => {
                    setAssignMentors(e.target.checked)
                    if (!e.target.checked) {
                      setPillarMentors({})
                    }
                  }}
                  className="accent-primary h-4 w-4 rounded border-gray-300 cursor-pointer"
                />
                <Label htmlFor="assignMentors" className="cursor-pointer font-medium text-sm">
                  Should we assign any mentor?
                </Label>
              </div>

              {assignMentors && (
                <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
                  <Label className="font-semibold text-xs text-foreground uppercase tracking-wider block">Assign Mentors to Pillars</Label>
                  {programPillars.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No pillars found in this program to assign mentors.</p>
                  ) : (
                    <div className="space-y-3">
                      {programPillars.map((pillar) => (
                        <div key={pillar.id} className="space-y-1">
                          <Label className="text-xs text-muted-foreground font-medium">Mentor for: {pillar.title}</Label>
                          <Select
                            value={pillarMentors[pillar.id] ? String(pillarMentors[pillar.id]) : ''}
                            onValueChange={(v) => setPillarMentors((current) => ({ ...current, [pillar.id]: v ? Number(v) : null }))}
                          >
                            <SelectTrigger className="w-full h-8 text-xs">
                              <SelectValue>
                                {(value: string | null) => {
                                  const mentor = eligibleMentors.find((m) => String(m.id) === value)
                                  return mentor ? mentorLabel(mentor) : t('programs.assignToCohort.mentorPlaceholder')
                                }}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {eligibleMentors.map((m) => (
                                <SelectItem key={m.id} value={String(m.id)}>
                                  {mentorLabel(m)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {items.length > 0 && (
                <div className="space-y-1.5">
                  <Label>{t('programs.assignToCohort.startDateLabel')}</Label>
                  <Input type="date" className="w-40" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  <p className="text-xs text-muted-foreground">{t('programs.assignToCohort.startDateHint')}</p>
                </div>
              )}

              {items.length === 0 && <p className="text-xs text-muted-foreground">{t('programs.assignToCohort.noCalendarItems')}</p>}

              {items.length > 0 && (
                <div className="space-y-1.5">
                  <Label>{t('programs.assignToCohort.datesLabel')}</Label>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div key={dateKey(item.type, item.id)} className="space-y-1.5 border-b pb-2 last:border-b-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm flex-1 min-w-0 truncate">{item.title}</span>
                          <Input
                            type="date"
                            className="w-40"
                            placeholder={startDate}
                            value={dates[dateKey(item.type, item.id)] ?? ''}
                            onChange={(e) => setDates((current) => ({ ...current, [dateKey(item.type, item.id)]: e.target.value }))}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:cancel')}
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!formValid || mutation.isPending}>
            {t('programs.assignToCohort.submitButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
