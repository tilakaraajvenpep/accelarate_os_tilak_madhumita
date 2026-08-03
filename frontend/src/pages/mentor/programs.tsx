import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ChevronDown, BookOpen, CalendarDays, CheckCircle2, FileText, FileClock, Lock, Eye, Building2, Users, MessageSquare } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { FillSectionFormDialog } from '@/components/fill-section-form-dialog'

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

interface AssignedProgram {
  id: number
  name: string
  description: string | null
  status: 'active' | 'inactive'
  completed: boolean
}

interface AssignedSectionForm {
  id: number
  name: string
  submitted: boolean
  status: 'not_started' | 'draft' | 'submitted'
}

interface AssignedSection {
  id: number
  title: string
  description: string | null
  scheduledDate: string | null
  forms: AssignedSectionForm[]
  completed: boolean
  locked: boolean
}

interface AssignedPillar {
  id: number
  title: string
  description: string | null
  scheduledDate: string | null
  sections: AssignedSection[]
  completed: boolean
  locked: boolean
  // Distinct from `locked` (an admin's manual toggle) — true when an earlier
  // step (see groupPillarsByStep) isn't fully complete yet, so this pillar
  // isn't reachable, even though nothing about it was locked by an admin.
  sequenceLocked: boolean
  parallelWithPrevious: boolean
  purpose: 'learning' | 'assessment'
  passThreshold: number | null
  scorePercentage: number | null
  hasKeyTakeawaysAndDiscussions: boolean
}

interface AssignedProgramDetail extends AssignedProgram {
  pillars: AssignedPillar[]
}

interface PillarComment {
  id: number
  body: string
  authorUserId: number
  authorRole: string
  authorName: string
  createdAt: string
}

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error
    ?? (err instanceof Error ? err.message : fallback)
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function MentorProgramsPage() {
  const { t } = useTranslation('program')
  const [selectedCohortId, setSelectedCohortId] = useState('')
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)

  const { data: assignments = [] } = useQuery({
    queryKey: ['mentor-assignments'],
    queryFn: async () => (await api.get<MentorAssignment[]>('/api/tenants/me/mentor/assignments')).data,
  })

  const cohorts = Array.from(new Map(assignments.map((a) => [a.cohortId, { id: a.cohortId, name: a.cohortName }])).values())

  const { data: companies = [] } = useQuery({
    queryKey: ['mentor-cohort-companies', selectedCohortId],
    queryFn: async () => (await api.get<MentorCohortCompany[]>(`/api/tenants/me/mentor/cohorts/${selectedCohortId}/companies`)).data,
    enabled: !!selectedCohortId,
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('mentorPrograms.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('mentorPrograms.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
        <div className="space-y-1.5">
          <Label>{t('mentorPrograms.cohortLabel')}</Label>
          <Select
            value={selectedCohortId}
            onValueChange={(v) => {
              if (v) { setSelectedCohortId(v); setSelectedCompanyId(null) }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('mentorPrograms.cohortPlaceholder')}>
                {(v: string) => cohorts.find((c) => String(c.id) === v)?.name ?? v}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {cohorts.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t('mentorPrograms.companyLabel')}</Label>
          <Select
            value={selectedCompanyId ? String(selectedCompanyId) : ''}
            onValueChange={(v) => v && setSelectedCompanyId(Number(v))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('mentorPrograms.companyPlaceholder')}>
                {(v: string) => {
                  const company = companies.find((c) => String(c.id.replace('company-', '')) === v)
                  return company?.name ?? v
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id.replace('company-', '')}>
                  {c.name ?? t('mentorPrograms.pendingSetup')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedCohortId ? (
        <Card className="border border-dashed p-10 text-center">
          <Users className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{t('mentorPrograms.selectCohortEmpty')}</p>
        </Card>
      ) : !selectedCompanyId ? (
        <Card className="border border-dashed p-10 text-center">
          <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{t('mentorPrograms.selectCompanyEmpty')}</p>
        </Card>
      ) : (
        <CompanyPrograms cohortId={Number(selectedCohortId)} companyId={selectedCompanyId} />
      )}
    </div>
  )
}

function CompanyPrograms({ cohortId, companyId }: { cohortId: number; companyId: number }) {
  const { t } = useTranslation('program')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const { data: programs = [], isLoading } = useQuery({
    queryKey: ['mentor-company-programs', cohortId, companyId],
    queryFn: async () => (await api.get<AssignedProgram[]>(`/api/tenants/me/mentor/cohorts/${cohortId}/companies/${companyId}/programs`)).data,
  })

  if (!isLoading && programs.length === 0) {
    return (
      <Card className="border border-dashed p-10 text-center">
        <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">{t('mentorPrograms.noPrograms')}</p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {programs.map((program) => (
        <MentorProgramRow
          key={program.id}
          program={program}
          cohortId={cohortId}
          companyId={companyId}
          expanded={expandedId === program.id}
          onToggle={() => setExpandedId((current) => (current === program.id ? null : program.id))}
        />
      ))}
    </div>
  )
}

function MentorProgramRow({
  program,
  cohortId,
  companyId,
  expanded,
  onToggle,
}: {
  program: AssignedProgram
  cohortId: number
  companyId: number
  expanded: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation('program')
  const queryClient = useQueryClient()
  const [fillingForm, setFillingForm] = useState<{ sectionId: number; formId: number; readOnly: boolean } | null>(null)

  const { data: detail, isLoading } = useQuery({
    queryKey: ['mentor-program-detail', cohortId, companyId, program.id],
    queryFn: async () =>
      (await api.get<AssignedProgramDetail>(`/api/tenants/me/mentor/cohorts/${cohortId}/companies/${companyId}/programs/${program.id}`)).data,
    enabled: expanded,
  })

  const markCompleteMutation = useMutation({
    mutationFn: async (sectionId: number) =>
      (await api.put(`/api/tenants/me/mentor/cohorts/${cohortId}/companies/${companyId}/programs/${program.id}/sections/${sectionId}/complete`)).data,
    onSuccess: () => {
      toast.success(t('founderPrograms.markDoneSuccess'))
      queryClient.invalidateQueries({ queryKey: ['mentor-program-detail', cohortId, companyId, program.id] })
    },
    onError: (err) => toast.error(apiError(err, t('founderPrograms.markDoneFailed'))),
  })

  const invalidateKey = ['mentor-program-detail', cohortId, companyId, program.id]

  return (
    <Card>
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-muted/50 transition-colors">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <BookOpen className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{program.name}</p>
          {program.description && <p className="text-xs text-muted-foreground truncate">{program.description}</p>}
        </div>
        {program.completed && (
          <Badge variant="success" className="gap-1 shrink-0">
            <CheckCircle2 className="h-3 w-3" /> {t('founderPrograms.completedBadge')}
          </Badge>
        )}
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <CardContent className="border-t pt-4 space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">…</p>
          ) : !detail || detail.pillars.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('founderPrograms.noPillars')}</p>
          ) : (
            <div className="grid gap-3">
              {detail.pillars.map((pillar) => (
                <MentorPillarCard
                  key={pillar.id}
                  pillar={pillar}
                  cohortId={cohortId}
                  companyId={companyId}
                  programId={program.id}
                  onFillForm={(sectionId, formId, readOnly) => setFillingForm({ sectionId, formId, readOnly })}
                  onMarkDone={(sectionId) => markCompleteMutation.mutate(sectionId)}
                  markDonePending={markCompleteMutation.isPending}
                />
              ))}
            </div>
          )}
        </CardContent>
      )}

      {fillingForm && (
        <FillSectionFormDialog
          open={!!fillingForm}
          onOpenChange={(open) => !open && setFillingForm(null)}
          fetchUrl={`/api/tenants/me/mentor/cohorts/${cohortId}/companies/${companyId}/programs/${program.id}/sections/${fillingForm.sectionId}/forms/${fillingForm.formId}`}
          saveUrl={`/api/tenants/me/mentor/cohorts/${cohortId}/companies/${companyId}/programs/${program.id}/sections/${fillingForm.sectionId}/forms/${fillingForm.formId}/response`}
          queryKey={['mentor-section-form', cohortId, companyId, program.id, fillingForm.sectionId, fillingForm.formId]}
          invalidateKey={invalidateKey}
          readOnly={fillingForm.readOnly}
          onSaved={() => queryClient.invalidateQueries({ queryKey: invalidateKey })}
        />
      )}
    </Card>
  )
}

function MentorPillarCard({
  pillar,
  cohortId,
  companyId,
  programId,
  onFillForm,
  onMarkDone,
  markDonePending,
}: {
  pillar: AssignedPillar
  cohortId: number
  companyId: number
  programId: number
  onFillForm: (sectionId: number, formId: number, readOnly: boolean) => void
  onMarkDone: (sectionId: number) => void
  markDonePending: boolean
}) {
  const { t } = useTranslation('program')
  const inaccessible = pillar.locked || pillar.sequenceLocked

  return (
    <div className={cn('rounded-lg border p-3 space-y-2', inaccessible ? 'bg-muted/60 opacity-75' : 'bg-muted/30')}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{pillar.title}</p>
        <div className="flex items-center gap-1.5 shrink-0">
          {inaccessible ? (
            <Badge variant="secondary" className="gap-1">
              <Lock className="h-3 w-3" /> {t('founderPrograms.lockedBadge')}
            </Badge>
          ) : (
            <>
              {pillar.purpose === 'assessment' && pillar.scorePercentage !== null ? (
                <Badge variant={pillar.completed ? 'success' : 'warning'} className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {pillar.completed
                    ? t('mentorPrograms.passedBadge', { score: pillar.scorePercentage })
                    : t('mentorPrograms.scoreBelowThresholdBadge', { score: pillar.scorePercentage, threshold: pillar.passThreshold })}
                </Badge>
              ) : (
                pillar.completed && (
                  <Badge variant="success" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" /> {t('founderPrograms.completedBadge')}
                  </Badge>
                )
              )}
              {pillar.scheduledDate && (
                <Badge variant="outline" className="gap-1">
                  <CalendarDays className="h-3 w-3" /> {formatDate(pillar.scheduledDate)}
                </Badge>
              )}
            </>
          )}
        </div>
      </div>

      {inaccessible ? (
        <p className="text-xs text-muted-foreground">
          {pillar.locked ? t('mentorPrograms.lockedPillarMessage') : t('mentorPrograms.sequenceLockedPillarMessage')}
        </p>
      ) : (
        <>
          {pillar.description && <p className="text-xs text-muted-foreground">{pillar.description}</p>}
          {pillar.hasKeyTakeawaysAndDiscussions && (
            <MentorPillarNotesAndDiscussion cohortId={cohortId} companyId={companyId} programId={programId} pillarId={pillar.id} />
          )}
          {pillar.sections.length > 0 && (
            <div className="space-y-2 pl-3 border-l">
              {pillar.sections.map((section) => (
                <div key={section.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm">{section.title}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {section.locked && (
                        <Badge variant="secondary" className="gap-1 text-[10px]">
                          <Lock className="h-3 w-3" /> {t('founderPrograms.lockedBadge')}
                        </Badge>
                      )}
                      {section.scheduledDate && !section.locked && (
                        <Badge variant="outline" className="gap-1 text-[10px]">
                          <CalendarDays className="h-3 w-3" /> {formatDate(section.scheduledDate)}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {!section.locked && section.forms.length > 0 && (
                    <div className="rounded-lg border divide-y overflow-hidden">
                      {section.forms.map((form) => (
                        <div key={form.id} className="flex items-center justify-between gap-2 px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {form.submitted ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                            ) : (
                              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            )}
                            <span className="text-xs font-medium truncate">{form.name}</span>
                            {form.status === 'draft' && (
                              <Badge variant="secondary" className="gap-1 text-[10px] shrink-0">
                                <FileClock className="h-3 w-3" /> {t('founderPrograms.draftSavedBadge')}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant={form.submitted ? 'outline' : 'default'}
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => onFillForm(section.id, form.id, false)}
                            >
                              {form.name}
                            </Button>
                            {form.submitted && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="h-7 w-7"
                                title={t('founderPrograms.viewSubmissionButton')}
                                onClick={() => onFillForm(section.id, form.id, true)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {!section.locked && section.forms.length === 0 && (
                    <Button
                      variant={section.completed ? 'outline' : 'default'}
                      size="sm"
                      className="h-7 text-xs"
                      disabled={section.completed || markDonePending}
                      onClick={() => onMarkDone(section.id)}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      {section.completed ? t('founderPrograms.completedBadge') : t('founderPrograms.markDoneButton')}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function MentorPillarNotesAndDiscussion({
  cohortId,
  companyId,
  programId,
  pillarId,
}: {
  cohortId: number
  companyId: number
  programId: number
  pillarId: number
}) {
  const { t } = useTranslation('program')
  const queryClient = useQueryClient()
  const base = `/api/tenants/me/mentor/cohorts/${cohortId}/companies/${companyId}/programs/${programId}/pillars/${pillarId}`

  const { data: note } = useQuery({
    queryKey: ['mentor-pillar-note', cohortId, companyId, programId, pillarId],
    queryFn: async () => (await api.get<{ keyTakeaways: string } | null>(`${base}/notes`)).data,
  })

  const commentsKey = ['mentor-pillar-comments', cohortId, companyId, programId, pillarId]
  const { data: comments = [] } = useQuery({
    queryKey: commentsKey,
    queryFn: async () => (await api.get<PillarComment[]>(`${base}/comments`)).data,
  })

  const [body, setBody] = useState('')
  const postMutation = useMutation({
    mutationFn: async () => (await api.post(`${base}/comments`, { body })).data,
    onSuccess: () => {
      setBody('')
      queryClient.invalidateQueries({ queryKey: commentsKey })
    },
    onError: (err) => toast.error(apiError(err, t('founderPrograms.discussion.postFailed'))),
  })

  return (
    <div className="rounded-lg border bg-background p-2.5 space-y-2">
      {note?.keyTakeaways && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('mentorPrograms.takeawaysTitle')}</p>
          <p className="text-xs mt-0.5">{note.keyTakeaways}</p>
        </div>
      )}
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <MessageSquare className="h-3 w-3" /> {t('founderPrograms.discussion.title')}
        </p>
        {comments.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('founderPrograms.discussion.empty')}</p>
        ) : (
          <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
            {comments.map((c) => (
              <div key={c.id} className="text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold">{c.authorName}</span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0">
                    {c.authorRole === 'mentor' ? t('founderPrograms.discussion.mentorBadge') : t('founderPrograms.discussion.founderBadge')}
                  </Badge>
                  <span className="text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                </div>
                <p className="mt-0.5">{c.body}</p>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-1.5">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={1}
            className="text-xs min-h-8"
            placeholder={t('founderPrograms.discussion.placeholder')}
          />
          <Button size="sm" className="h-8 text-[11px] shrink-0" disabled={!body.trim() || postMutation.isPending} onClick={() => postMutation.mutate()}>
            {t('founderPrograms.discussion.postButton')}
          </Button>
        </div>
      </div>
    </div>
  )
}
