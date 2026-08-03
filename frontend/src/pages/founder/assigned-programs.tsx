import { useRef, useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  ChevronDown,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Circle,
  FileText,
  FileClock,
  Lock,
  Users,
  Eye,
  ClipboardList,
  Pencil,
  GitBranch,
  Download,
  FolderOpen,
  Trash2,
  MessageSquare,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn, downloadFile } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { FillSectionFormDialog } from '@/components/fill-section-form-dialog'
import { FillCohortFormDialog } from '@/components/fill-cohort-form-dialog'
import { ProgramFeedbackModal } from '@/components/program-feedback-modal'
import { DocumentPreview } from '@/components/document-preview'
import { useViewAsCompany } from '@/context/view-as-context'
import { useConfirm } from '@/components/confirm-dialog'

interface CohortFormEntry {
  formId: number
  title: string
  access: 'fillable' | 'locked' | 'view_only'
  status: 'not_started' | 'draft' | 'submitted'
  claimedByName: string | null
}

interface AssignedProgram {
  id: number
  name: string
  description: string | null
  status: 'active' | 'inactive'
  completed: boolean
}

interface FormAttempt {
  branchNumber: number
  status: 'draft' | 'submitted'
  submittedAt: string | null
  scorePercentage: number | null
  hasDocument: boolean
}

interface AssignedSectionForm {
  id: number
  name: string
  submitted: boolean
  status: 'not_started' | 'draft' | 'submitted'
  // Who on the team may fill this in right now (see section_forms.fillPolicy) —
  // 'locked' means a teammate is the designated filler (either the primary
  // founder, under fillPolicy 'primary_founder', or whoever claimed it first
  // under 'first_claim') and this viewer isn't them.
  access?: 'fillable' | 'locked' | 'view_only'
  claimedByName?: string | null
  scorePercentage: number | null
  submittedAt: string | null
  hasDocument: boolean
  // Every "branch out" attempt at this form, oldest first — branching keeps the older
  // attempt's response exactly as submitted and starts a brand new, independent one.
  attempts: FormAttempt[]
}

interface AssignedSection {
  id: number
  title: string
  description: string | null
  scheduledDate: string | null
  forms: AssignedSectionForm[]
  completed: boolean
  locked: boolean
  scorePercentage: number | null
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
  completionPercentage: number
  hasReadinessChecklist: boolean
  hasKeyTakeawaysAndDiscussions: boolean
}

interface AssignedProgramDetail extends AssignedProgram {
  pillars: AssignedPillar[]
}

interface Material {
  id: number
  title: string
  fileName: string
  fileSize: number
  uploadedByUserId: number
  uploadedByName: string
  createdAt: string
}

interface PillarComment {
  id: number
  body: string
  authorUserId: number
  authorRole: string
  authorName: string
  createdAt: string
}

interface ChecklistQuestion {
  id: number
  prompt: string
  type: 'text' | 'checkbox'
  sortOrder: number
}

interface ChecklistAnswer {
  questionId: number
  answerText: string | null
  answerBool: boolean | null
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

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** A, B, C, … Z, AA, AB, … — plain spreadsheet-style column labeling for section letters. */
function sectionLetter(index: number): string {
  let n = index
  let label = ''
  do {
    label = String.fromCharCode(65 + (n % 26)) + label
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return label
}

/** Groups pillars (already in sortOrder) into consecutive runs for the hierarchy layout — a
 *  pillar with parallelWithPrevious=true joins the run started by the pillar before it, everyone
 *  else starts a new run/step. Purely for layout — actual access restriction (a step only
 *  reachable once every earlier step is complete) is computed server-side as `sequenceLocked`. */
function groupPillarsByStep(pillarList: AssignedPillar[]) {
  const groups: AssignedPillar[][] = []
  for (const pillar of pillarList) {
    if (pillar.parallelWithPrevious && groups.length > 0) {
      groups[groups.length - 1].push(pillar)
    } else {
      groups.push([pillar])
    }
  }
  return groups
}

export default function AssignedProgramsPage() {
  const { t } = useTranslation('program')
  const viewAs = useViewAsCompany()
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const { data: programs = [], isLoading } = useQuery({
    queryKey: ['founder-programs', viewAs?.companyId],
    queryFn: async () =>
      (
        await api.get<AssignedProgram[]>(
          viewAs ? `/api/tenants/me/companies/${viewAs.companyId}/view-as/programs` : '/api/tenants/me/founder/programs',
        )
      ).data,
  })

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('founderPrograms.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('founderPrograms.subtitle')}</p>
      </div>

      {/* Cohort-wide forms are claimed by whichever founder fills them first — not meaningful to mirror in a read-only admin preview. */}
      {!viewAs && <CohortFormsSection />}

      {!isLoading && programs.length === 0 && (
        <div className="surface-card p-8 text-center">
          <ClipboardList className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">{t('founderPrograms.empty')}</p>
        </div>
      )}

      <div className="space-y-3">
        {programs.map((program) => (
          <FounderProgramRow
            key={program.id}
            program={program}
            expanded={expandedId === program.id}
            onToggle={() => setExpandedId((current) => (current === program.id ? null : program.id))}
          />
        ))}
      </div>
    </div>
  )
}

function CohortFormsSection() {
  const { t } = useTranslation('program')
  const [fillingFormId, setFillingFormId] = useState<number | null>(null)
  const [fillingReadOnly, setFillingReadOnly] = useState(false)

  const { data: cohortForms = [], isLoading } = useQuery({
    queryKey: ['founder-cohort-forms'],
    queryFn: async () => (await api.get<CohortFormEntry[]>('/api/tenants/me/founder/cohort-forms')).data,
  })

  if (!isLoading && cohortForms.length === 0) return null

  function openForm(entry: CohortFormEntry) {
    setFillingReadOnly(entry.access === 'view_only')
    setFillingFormId(entry.formId)
  }

  return (
    <div className="surface-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold text-sm">{t('founderPrograms.cohortForms.title')}</h2>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">{t('founderPrograms.cohortForms.subtitle')}</p>

      <div className="space-y-2">
        {cohortForms.map((entry) => (
          <div key={entry.formId} className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{entry.title}</p>
              {entry.access === 'locked' && (
                <p className="text-xs text-muted-foreground">
                  {entry.claimedByName
                    ? t('founderPrograms.cohortForms.lockedByName', { name: entry.claimedByName })
                    : t('founderPrograms.cohortForms.lockedGeneric')}
                </p>
              )}
            </div>
            {entry.access === 'locked' ? (
              <Badge variant="secondary" className="gap-1 shrink-0">
                <Lock className="h-3 w-3" /> {t('founderPrograms.lockedBadge')}
              </Badge>
            ) : (
              <Button variant={entry.status === 'submitted' ? 'outline' : 'default'} size="sm" className="shrink-0" onClick={() => openForm(entry)}>
                {entry.status === 'submitted' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                {entry.access === 'view_only'
                  ? t('founderPrograms.cohortForms.viewButton')
                  : entry.status === 'submitted'
                    ? t('founderPrograms.completedBadge')
                    : t('founderPrograms.cohortForms.fillButton')}
              </Button>
            )}
          </div>
        ))}
      </div>

      {fillingFormId !== null && (
        <FillCohortFormDialog
          open={fillingFormId !== null}
          onOpenChange={(open) => !open && setFillingFormId(null)}
          formId={fillingFormId}
          readOnly={fillingReadOnly}
          onSaved={() => setFillingFormId(null)}
        />
      )}
    </div>
  )
}

function FounderProgramRow({ program, expanded, onToggle }: { program: AssignedProgram; expanded: boolean; onToggle: () => void }) {
  const { t } = useTranslation('program')
  const queryClient = useQueryClient()
  const viewAs = useViewAsCompany()
  const [fillingForm, setFillingForm] = useState<{ sectionId: number; formId: number; readOnly: boolean; branch?: number } | null>(null)

  const base = viewAs ? `/api/tenants/me/companies/${viewAs.companyId}/view-as/programs/${program.id}` : `/api/tenants/me/founder/programs/${program.id}`
  const invalidateKey = viewAs ? ['view-as-program', viewAs.companyId, program.id] : ['founder-program', program.id]

  const { data: detail, isLoading } = useQuery({
    queryKey: invalidateKey,
    queryFn: async () => (await api.get<AssignedProgramDetail>(base)).data,
    enabled: expanded,
  })

  const [showFeedback, setShowFeedback] = useState(false)

  // A mandatory, still-unsubmitted feedback form must reappear on every visit
  // to a completed program — not just right after the action that completed
  // it (e.g. the founder closed the tab before submitting last time).
  const { data: pendingFeedback } = useQuery({
    queryKey: ['program-feedback', program.id, undefined],
    queryFn: async () => (await api.get<{ mapping: { mandatory: boolean }; pending: boolean } | null>(`/api/programs/${program.id}/feedback`)).data,
    enabled: expanded && !!detail?.completed && !viewAs,
  })

  useEffect(() => {
    if (pendingFeedback?.mapping.mandatory && pendingFeedback.pending) setShowFeedback(true)
  }, [pendingFeedback])

  function maybeShowFeedback(result?: { feedbackForm?: { mandatory: boolean } | null }) {
    if (result?.feedbackForm) setShowFeedback(true)
  }

  const markCompleteMutation = useMutation({
    mutationFn: async (sectionId: number) => (await api.put(`/api/tenants/me/founder/programs/${program.id}/sections/${sectionId}/complete`)).data,
    onSuccess: (result: { feedbackForm?: { mandatory: boolean } | null }) => {
      toast.success(t('founderPrograms.markDoneSuccess'))
      queryClient.invalidateQueries({ queryKey: invalidateKey })
      maybeShowFeedback(result)
    },
    onError: (err) => toast.error(apiError(err, t('founderPrograms.markDoneFailed'))),
  })

  const branchMutation = useMutation({
    mutationFn: async ({ sectionId, formId }: { sectionId: number; formId: number }) =>
      (await api.post(`/api/tenants/me/founder/programs/${program.id}/sections/${sectionId}/forms/${formId}/branch`)).data,
    onSuccess: (_result, { sectionId, formId }) => {
      queryClient.invalidateQueries({ queryKey: invalidateKey })
      setFillingForm({ sectionId, formId, readOnly: false })
    },
    onError: (err) => toast.error(apiError(err, t('founderPrograms.table.branchFailed'))),
  })

  function formQueryKey(sectionId: number, formId: number, branch?: number) {
    return [...invalidateKey, 'section-form', sectionId, formId, branch ?? 'latest']
  }

  function formFetchUrl(sectionId: number, formId: number, branch?: number) {
    return `${base}/sections/${sectionId}/forms/${formId}${branch !== undefined ? `?branch=${branch}` : ''}`
  }

  function prefetchForm(sectionId: number, formId: number, branch?: number) {
    queryClient.prefetchQuery({
      queryKey: formQueryKey(sectionId, formId, branch),
      queryFn: async () => (await api.get(formFetchUrl(sectionId, formId, branch))).data,
      staleTime: 30_000,
    })
  }

  const pillarNumberById = new Map((detail?.pillars ?? []).map((p, i) => [p.id, i + 1]))

  return (
    <div className="surface-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <BookOpen className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{program.name}</p>
          {program.description && <p className="text-xs text-muted-foreground truncate">{program.description}</p>}
        </div>
        {program.completed && (
          <Badge variant="success" className="gap-1 shrink-0">
            <CheckCircle2 className="h-3 w-3" />
            {t('founderPrograms.completedBadge')}
          </Badge>
        )}
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="border-t px-5 py-5 space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">…</p>
          ) : !detail || detail.pillars.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('founderPrograms.noPillars')}</p>
          ) : (
            groupPillarsByStep(detail.pillars).map((group, groupIndex) => (
              <div key={group[0].id}>
                {groupIndex > 0 && (
                  <div className="flex justify-center py-1">
                    <div className="w-px h-4 bg-border" />
                  </div>
                )}
                <div className={cn('grid gap-4', group.length > 1 ? 'sm:grid-cols-2' : 'grid-cols-1')}>
                  {group.map((pillar) => (
                    <PillarCard
                      key={pillar.id}
                      baseUrl={base}
                      pillar={pillar}
                      pillarNumber={pillarNumberById.get(pillar.id) ?? 1}
                      previewMode={!!viewAs}
                      onFillForm={(sectionId, formId, readOnly, branch) => {
                        setFillingForm({ sectionId, formId, readOnly: readOnly || !!viewAs, branch })
                      }}
                      onPrefetchForm={prefetchForm}
                      onBranch={(sectionId, formId) => branchMutation.mutate({ sectionId, formId })}
                      onDownloadForm={(sectionId, formId, fileName, branch) =>
                        downloadFile(`${base}/sections/${sectionId}/forms/${formId}/document${branch !== undefined ? `?branch=${branch}` : ''}`, fileName)
                      }
                      onMarkDone={(sectionId) => markCompleteMutation.mutate(sectionId)}
                      markDonePending={markCompleteMutation.isPending}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {fillingForm && (
        <FillSectionFormDialog
          open={!!fillingForm}
          onOpenChange={(open) => !open && setFillingForm(null)}
          fetchUrl={formFetchUrl(fillingForm.sectionId, fillingForm.formId, fillingForm.branch)}
          saveUrl={`/api/tenants/me/founder/programs/${program.id}/sections/${fillingForm.sectionId}/forms/${fillingForm.formId}/response`}
          queryKey={formQueryKey(fillingForm.sectionId, fillingForm.formId, fillingForm.branch)}
          invalidateKey={invalidateKey}
          readOnly={fillingForm.readOnly}
          onSaved={(result) => {
            queryClient.invalidateQueries({ queryKey: invalidateKey })
            maybeShowFeedback(result)
          }}
        />
      )}

      {!viewAs && <ProgramFeedbackModal programId={program.id} open={showFeedback} onClose={() => setShowFeedback(false)} />}
    </div>
  )
}

function PillarCard({
  baseUrl,
  pillar,
  pillarNumber,
  previewMode,
  onFillForm,
  onPrefetchForm,
  onBranch,
  onDownloadForm,
  onMarkDone,
  markDonePending,
}: {
  baseUrl: string
  pillar: AssignedPillar
  pillarNumber: number
  previewMode?: boolean
  onFillForm: (sectionId: number, formId: number, readOnly: boolean, branch?: number) => void
  onPrefetchForm: (sectionId: number, formId: number, branch?: number) => void
  onBranch: (sectionId: number, formId: number) => void
  onDownloadForm: (sectionId: number, formId: number, fileName: string, branch?: number) => void
  onMarkDone: (sectionId: number) => void
  markDonePending: boolean
}) {
  const { t } = useTranslation('program')
  const inaccessible = pillar.locked || pillar.sequenceLocked

  return (
    <div className={cn('rounded-xl border p-4 space-y-3', inaccessible ? 'bg-muted/60 opacity-75' : 'bg-card')}>
      <div className="flex items-start justify-between gap-2">
        <Badge variant="outline" className="text-[10px] font-semibold tracking-wide uppercase">
          {t('founderPrograms.pillarBadge', { n: pillarNumber })}
        </Badge>
        <div className="h-7 w-7 rounded-full border flex items-center justify-center shrink-0 text-muted-foreground">
          {inaccessible ? <Lock className="h-3.5 w-3.5" /> : <CheckCircle2 className={cn('h-3.5 w-3.5', pillar.completed && 'text-foreground')} />}
        </div>
      </div>

      <p className="text-base font-bold leading-tight">{pillar.title}</p>

      <div className="flex flex-wrap items-center gap-1.5">
        {inaccessible ? (
          <Badge variant="secondary" className="gap-1">
            <Lock className="h-3 w-3" />
            {t('founderPrograms.lockedBadge')}
          </Badge>
        ) : (
          <>
            {pillar.purpose === 'assessment' && pillar.scorePercentage !== null && (
              <Badge variant={pillar.completed ? 'success' : 'warning'} className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {pillar.completed
                  ? t('founderPrograms.passedBadge', { score: pillar.scorePercentage })
                  : t('founderPrograms.scoreBelowThresholdBadge', { score: pillar.scorePercentage, threshold: pillar.passThreshold })}
              </Badge>
            )}
            {pillar.scheduledDate && (
              <Badge variant="outline" className="gap-1">
                <CalendarDays className="h-3 w-3" />
                {formatDate(pillar.scheduledDate)}
              </Badge>
            )}
          </>
        )}
      </div>

      {inaccessible ? (
        <p className="text-xs text-muted-foreground">
          {pillar.locked ? t('founderPrograms.lockedPillarMessage') : t('founderPrograms.sequenceLockedPillarMessage')}
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>{t('founderPrograms.completionStatus')}</span>
              <span className="text-foreground text-sm font-bold normal-case tracking-normal">{pillar.completionPercentage}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${pillar.completionPercentage}%` }} />
            </div>
          </div>

          {pillar.description && <p className="text-xs text-muted-foreground">{pillar.description}</p>}

          {!previewMode && (
            <MaterialsList
              listUrl={`${baseUrl}/pillars/${pillar.id}/materials`}
              itemUrlBase={`${baseUrl}/pillars/${pillar.id}/materials`}
              queryKey={['pillar-materials', baseUrl, pillar.id]}
            />
          )}

          {!previewMode && pillar.hasReadinessChecklist && <PillarChecklistPanel baseUrl={baseUrl} pillarId={pillar.id} />}

          {pillar.sections.length > 0 && (
            <div className="space-y-2.5">
              {pillar.sections.map((section, sectionIndex) => (
                <SectionCard
                  key={section.id}
                  baseUrl={baseUrl}
                  section={section}
                  sectionLabel={sectionLetter(sectionIndex)}
                  previewMode={previewMode}
                  onFillForm={onFillForm}
                  onPrefetchForm={onPrefetchForm}
                  onBranch={onBranch}
                  onDownloadForm={onDownloadForm}
                  onMarkDone={onMarkDone}
                  markDonePending={markDonePending}
                />
              ))}
            </div>
          )}

          {!previewMode && pillar.hasKeyTakeawaysAndDiscussions && (
            <>
              <PillarTakeawaysPanel baseUrl={baseUrl} pillarId={pillar.id} />
              <PillarDiscussionPanel
                listUrl={`${baseUrl}/pillars/${pillar.id}/comments`}
                postUrl={`${baseUrl}/pillars/${pillar.id}/comments`}
                queryKey={['pillar-comments', baseUrl, pillar.id]}
              />
            </>
          )}
        </>
      )}
    </div>
  )
}

function SectionCard({
  baseUrl,
  section,
  sectionLabel,
  previewMode,
  onFillForm,
  onPrefetchForm,
  onBranch,
  onDownloadForm,
  onMarkDone,
  markDonePending,
}: {
  baseUrl: string
  section: AssignedSection
  sectionLabel: string
  previewMode?: boolean
  onFillForm: (sectionId: number, formId: number, readOnly: boolean, branch?: number) => void
  onPrefetchForm: (sectionId: number, formId: number, branch?: number) => void
  onBranch: (sectionId: number, formId: number) => void
  onDownloadForm: (sectionId: number, formId: number, fileName: string, branch?: number) => void
  onMarkDone: (sectionId: number) => void
  markDonePending: boolean
}) {
  const { t } = useTranslation('program')
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl border overflow-hidden bg-background">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        {section.completed ? (
          <CheckCircle2 className="h-5 w-5 text-foreground shrink-0" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold truncate">
            {t('founderPrograms.sectionLabel', { letter: sectionLabel })}: {section.title}
          </p>
          {section.description && <p className="text-xs text-muted-foreground truncate">{section.description}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {section.scorePercentage !== null && (
            <Badge variant="outline" className="gap-1 text-[10px]">
              {t('founderPrograms.table.aiScoreBadge', { score: section.scorePercentage })}
            </Badge>
          )}
          {section.locked && (
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <Lock className="h-3 w-3" />
              {t('founderPrograms.lockedBadge')}
            </Badge>
          )}
          {section.scheduledDate && !section.locked && (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <CalendarDays className="h-3 w-3" />
              {formatDate(section.scheduledDate)}
            </Badge>
          )}
        </div>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="border-t p-3 space-y-2.5">
          {!section.locked && !previewMode && (
            <MaterialsList
              listUrl={`${baseUrl}/sections/${section.id}/materials`}
              itemUrlBase={`${baseUrl}/sections/${section.id}/materials`}
              queryKey={['section-materials', baseUrl, section.id]}
              compact
            />
          )}

          {!section.locked && section.forms.length > 0 && (
            <div className="space-y-2">
              {section.forms.map((form) => (
                <FormCard
                  key={form.id}
                  sectionId={section.id}
                  form={form}
                  previewMode={previewMode}
                  onFillForm={onFillForm}
                  onPrefetchForm={onPrefetchForm}
                  onBranch={onBranch}
                  onDownloadForm={onDownloadForm}
                />
              ))}
            </div>
          )}
          {!section.locked && section.forms.length === 0 && (
            <Button
              variant={section.completed ? 'outline' : 'default'}
              size="sm"
              className="h-7 text-xs"
              disabled={section.completed || markDonePending || previewMode}
              onClick={() => onMarkDone(section.id)}
            >
              <CheckCircle2 className="h-3 w-3" />
              {section.completed ? t('founderPrograms.completedBadge') : t('founderPrograms.markDoneButton')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/** A single form, laid out as a self-contained card (not a table) so it never needs horizontal
 *  scrolling — every field wraps naturally even inside a narrow (2-up) pillar card. Once there's
 *  more than one attempt (a "branch out" happened), every attempt renders as its own visible row
 *  — the older one(s) stay exactly as submitted, and only the latest is ever fillable. */
function FormCard({
  sectionId,
  form,
  previewMode,
  onFillForm,
  onPrefetchForm,
  onBranch,
  onDownloadForm,
}: {
  sectionId: number
  form: AssignedSectionForm
  previewMode?: boolean
  onFillForm: (sectionId: number, formId: number, readOnly: boolean, branch?: number) => void
  onPrefetchForm: (sectionId: number, formId: number, branch?: number) => void
  onBranch: (sectionId: number, formId: number) => void
  onDownloadForm: (sectionId: number, formId: number, fileName: string, branch?: number) => void
}) {
  const { t } = useTranslation('program')
  const formLocked = form.access === 'locked'
  const showAttemptLabels = form.attempts.length > 1

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {form.submitted ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-foreground shrink-0" />
        ) : formLocked ? (
          <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <span className="font-semibold truncate">{form.name}</span>
      </div>

      {form.attempts.length === 0 ? (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground">{t('founderPrograms.table.notStarted')}</span>
          {!formLocked && !previewMode && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              title={t('founderPrograms.table.fillTitle')}
              onMouseEnter={() => onPrefetchForm(sectionId, form.id)}
              onClick={() => onFillForm(sectionId, form.id, false)}
            >
              <Pencil className="h-3.5 w-3.5" /> {t('founderPrograms.table.editButton')}
            </Button>
          )}
        </div>
      ) : (
        <div className={cn('space-y-2.5', showAttemptLabels && 'pl-4 border-l')}>
          {form.attempts.map((attempt, i) => (
            <AttemptRow
              key={attempt.branchNumber}
              sectionId={sectionId}
              formId={form.id}
              formName={form.name}
              attempt={attempt}
              label={showAttemptLabels ? t('founderPrograms.table.attemptLink', { n: attempt.branchNumber }) : null}
              isLatest={i === form.attempts.length - 1}
              formLocked={formLocked}
              claimedByName={form.claimedByName}
              previewMode={previewMode}
              onFillForm={onFillForm}
              onPrefetchForm={onPrefetchForm}
              onBranch={onBranch}
              onDownloadForm={onDownloadForm}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** One attempt's own status/date/score + its own actions — only the LATEST attempt can ever be
 *  edited/branched-out-from; every earlier one is always-submitted and view/download-only. */
function AttemptRow({
  sectionId,
  formId,
  formName,
  attempt,
  label,
  isLatest,
  formLocked,
  claimedByName,
  previewMode,
  onFillForm,
  onPrefetchForm,
  onBranch,
  onDownloadForm,
}: {
  sectionId: number
  formId: number
  formName: string
  attempt: FormAttempt
  label: string | null
  isLatest: boolean
  formLocked: boolean
  claimedByName?: string | null
  previewMode?: boolean
  onFillForm: (sectionId: number, formId: number, readOnly: boolean, branch?: number) => void
  onPrefetchForm: (sectionId: number, formId: number, branch?: number) => void
  onBranch: (sectionId: number, formId: number) => void
  onDownloadForm: (sectionId: number, formId: number, fileName: string, branch?: number) => void
}) {
  const { t } = useTranslation('program')
  const submitted = attempt.status === 'submitted'
  const branch = isLatest ? undefined : attempt.branchNumber
  const lockedHere = isLatest && formLocked

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        {label && <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>}
        {submitted ? (
          <Badge variant="success" className="text-[10px]">
            {t('founderPrograms.completedBadge')}
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <FileClock className="h-3 w-3" /> {t('founderPrograms.draftSavedBadge')}
          </Badge>
        )}
        {lockedHere && (
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <Lock className="h-3 w-3" />
            {claimedByName ? t('founderPrograms.cohortForms.lockedByName', { name: claimedByName }) : t('founderPrograms.cohortForms.lockedGeneric')}
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
        <span>
          {t('founderPrograms.table.submittedOn')}: {attempt.submittedAt ? formatDateTime(attempt.submittedAt) : '—'}
        </span>
        <span>
          {t('founderPrograms.table.aiScore')}: {attempt.scorePercentage !== null ? t('founderPrograms.table.aiScoreBadge', { score: attempt.scorePercentage }) : '—'}
        </span>
      </div>
      {!lockedHere && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {submitted && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              title={t('founderPrograms.table.viewTitle')}
              onMouseEnter={() => onPrefetchForm(sectionId, formId, branch)}
              onClick={() => onFillForm(sectionId, formId, true, branch)}
            >
              <Eye className="h-3.5 w-3.5" /> {t('founderPrograms.table.viewButton')}
            </Button>
          )}
          {!submitted && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              title={t('founderPrograms.table.fillTitle')}
              onMouseEnter={() => onPrefetchForm(sectionId, formId, branch)}
              onClick={() => onFillForm(sectionId, formId, false, branch)}
            >
              <Pencil className="h-3.5 w-3.5" /> {t('founderPrograms.table.editButton')}
            </Button>
          )}
          {submitted && isLatest && !previewMode && (
            <Button variant="outline" size="sm" className="h-7 text-xs" title={t('founderPrograms.table.branchTitle')} onClick={() => onBranch(sectionId, formId)}>
              <GitBranch className="h-3.5 w-3.5" /> {t('founderPrograms.table.branchButton')}
            </Button>
          )}
          {attempt.hasDocument && (
            <Button
              variant="ghost"
              size="icon-sm"
              title={t('founderPrograms.table.downloadTitle')}
              onClick={() => onDownloadForm(sectionId, formId, formName, branch)}
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function MaterialsList({
  listUrl,
  itemUrlBase,
  queryKey,
  compact,
}: {
  listUrl: string
  itemUrlBase: string
  queryKey: unknown[]
  compact?: boolean
}) {
  const { t } = useTranslation('program')
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: materials = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => (await api.get<Material[]>(listUrl)).data,
  })

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fileData = await readFileAsDataUrl(file)
      return (
        await api.post(itemUrlBase, {
          title: file.name,
          fileName: file.name,
          fileType: file.type || 'application/octet-stream',
          fileData,
          fileSize: file.size,
        })
      ).data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (err) => toast.error(apiError(err, t('founderPrograms.materials.uploadFailed'))),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => (await api.delete(`${itemUrlBase}/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (err) => toast.error(apiError(err, t('founderPrograms.materials.deleteFailed'))),
  })

  const [previewingId, setPreviewingId] = useState<number | null>(null)

  return (
    <div className={cn('rounded-lg border bg-background p-2.5 space-y-1.5', compact && 'text-xs')}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <FolderOpen className="h-3 w-3" /> {t('founderPrograms.materials.title')}
        </p>
        <button
          type="button"
          className="text-[11px] text-primary hover:underline disabled:opacity-50 shrink-0"
          disabled={uploadMutation.isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          {t('founderPrograms.materials.uploadButton')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) uploadMutation.mutate(file)
          }}
        />
      </div>
      {!isLoading && materials.length === 0 && <p className="text-xs text-muted-foreground">{t('founderPrograms.materials.empty')}</p>}
      {materials.length > 0 && (
        <div className="space-y-1">
          {materials.map((m) => (
            <div key={m.id}>
              <div className="flex items-center justify-between gap-2 rounded-md border px-2 py-1">
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{m.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {formatFileSize(m.fileSize)} · {t('founderPrograms.materials.uploadedBy', { name: m.uploadedByName })}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title={t('founderPrograms.materials.viewButton')}
                    onClick={() => setPreviewingId((current) => (current === m.id ? null : m.id))}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => downloadFile(`${itemUrlBase}/${m.id}`, m.fileName)}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={deleteMutation.isPending}
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Confirm Deletion',
                        description: 'Are you sure you want to delete this material? This action cannot be undone.',
                        confirmLabel: 'Delete',
                        variant: 'destructive',
                      })
                      if (ok) {
                        deleteMutation.mutate(m.id)
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
              {previewingId === m.id && (
                <DocumentPreview fetchUrl={`${itemUrlBase}/${m.id}`} fileName={m.fileName} open hideTrigger onOpenChange={() => {}} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PillarTakeawaysPanel({ baseUrl, pillarId }: { baseUrl: string; pillarId: number }) {
  const { t } = useTranslation('program')
  const queryClient = useQueryClient()
  const queryKey = ['pillar-note', baseUrl, pillarId]
  const { data } = useQuery({
    queryKey,
    queryFn: async () => (await api.get<{ keyTakeaways: string } | null>(`${baseUrl}/pillars/${pillarId}/notes`)).data,
  })

  const [value, setValue] = useState('')
  const [seededFor, setSeededFor] = useState<number | null>(null)
  if (data !== undefined && seededFor !== pillarId) {
    setSeededFor(pillarId)
    setValue(data?.keyTakeaways ?? '')
  }

  const saveMutation = useMutation({
    mutationFn: async () => (await api.put(`${baseUrl}/pillars/${pillarId}/notes`, { keyTakeaways: value })).data,
    onSuccess: () => {
      toast.success(t('founderPrograms.takeaways.saved'))
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (err) => toast.error(apiError(err, t('founderPrograms.takeaways.saveFailed'))),
  })

  return (
    <div className="rounded-lg border bg-background p-2.5 space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('founderPrograms.takeaways.title')}</p>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        placeholder={t('founderPrograms.takeaways.placeholder')}
        className="text-xs min-h-14"
      />
      <div className="flex justify-end">
        <Button size="sm" variant="outline" className="h-6 text-[11px]" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          {t('founderPrograms.takeaways.saveButton')}
        </Button>
      </div>
    </div>
  )
}

function PillarDiscussionPanel({ listUrl, postUrl, queryKey }: { listUrl: string; postUrl: string; queryKey: unknown[] }) {
  const { t } = useTranslation('program')
  const queryClient = useQueryClient()
  const { data: comments = [] } = useQuery({
    queryKey,
    queryFn: async () => (await api.get<PillarComment[]>(listUrl)).data,
  })
  const [body, setBody] = useState('')

  const postMutation = useMutation({
    mutationFn: async () => (await api.post(postUrl, { body })).data,
    onSuccess: () => {
      setBody('')
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (err) => toast.error(apiError(err, t('founderPrograms.discussion.postFailed'))),
  })

  return (
    <div className="rounded-lg border bg-background p-2.5 space-y-1.5">
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
  )
}

function PillarChecklistPanel({ baseUrl, pillarId }: { baseUrl: string; pillarId: number }) {
  const { t } = useTranslation('program')
  const queryClient = useQueryClient()
  const queryKey = ['pillar-checklist', baseUrl, pillarId]
  const { data } = useQuery({
    queryKey,
    queryFn: async () => (await api.get<{ questions: ChecklistQuestion[]; answers: ChecklistAnswer[] }>(`${baseUrl}/pillars/${pillarId}/checklist`)).data,
  })

  const [values, setValues] = useState<Record<number, string | boolean>>({})
  const [seededFor, setSeededFor] = useState<number | null>(null)
  if (data && seededFor !== pillarId) {
    setSeededFor(pillarId)
    const seeded: Record<number, string | boolean> = {}
    for (const q of data.questions) {
      const answer = data.answers.find((a) => a.questionId === q.id)
      seeded[q.id] = q.type === 'checkbox' ? !!answer?.answerBool : (answer?.answerText ?? '')
    }
    setValues(seeded)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const answers = (data?.questions ?? []).map((q) => ({
        questionId: q.id,
        answerText: q.type === 'text' ? String(values[q.id] ?? '') : null,
        answerBool: q.type === 'checkbox' ? !!values[q.id] : null,
      }))
      return (await api.put(`${baseUrl}/pillars/${pillarId}/checklist`, { answers })).data
    },
    onSuccess: () => {
      toast.success(t('founderPrograms.checklist.saved'))
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (err) => toast.error(apiError(err, t('founderPrograms.checklist.saveFailed'))),
  })

  if (!data || data.questions.length === 0) return null

  return (
    <div className="rounded-lg border bg-background p-2.5 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        <ClipboardList className="h-3 w-3" /> {t('founderPrograms.checklist.title')}
      </p>
      <div className="space-y-2">
        {data.questions.map((q) => (
          <div key={q.id}>
            {q.type === 'checkbox' ? (
              <label className="flex items-start gap-2 text-xs cursor-pointer">
                <Checkbox checked={!!values[q.id]} onCheckedChange={(c) => setValues((v) => ({ ...v, [q.id]: !!c }))} className="mt-0.5" />
                <span>{q.prompt}</span>
              </label>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs">{q.prompt}</Label>
                <Input
                  className="h-7 text-xs"
                  value={String(values[q.id] ?? '')}
                  onChange={(e) => setValues((v) => ({ ...v, [q.id]: e.target.value }))}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <Button size="sm" className="h-6 text-[11px]" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          {t('founderPrograms.checklist.submitButton')}
        </Button>
      </div>
    </div>
  )
}
