import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Users, ChevronDown, CalendarRange, CalendarPlus, CheckCircle2, Circle, FileText, Eye, UserCog } from 'lucide-react'
import { AssignProgramToCohortDialog } from '@/components/assign-program-to-cohort-dialog'
import { useConfirm } from '@/components/confirm-dialog'
import { useAuth } from '@/context/auth-context'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { ListToolbar, ListPagination } from '@/components/list-toolbar'
import { useListControls } from '@/hooks/use-list-controls'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import type { Cohort } from '@/types/cohort'
import type { FormTemplateSummary } from '@/types/forms'

interface CohortFormAttachment {
  id: number
  formId: number
  title: string
  fillPolicy: 'primary_founder' | 'first_claim'
  createdAt: string
}

interface CompanyProgress {
  companyId: number
  programId: number
  programName: string
  completedPillars: number
  totalPillars: number
  completed: boolean
}

import type { CohortTask } from '@/types/cohort-task'
import type { CompanyEntry, CompanyEntryStatus, CompanyInviteResult } from '@/types/company'

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error
    ?? (err instanceof Error ? err.message : fallback)
}

function statusBadge(status: CompanyEntryStatus): { label: string; variant: 'success' | 'warning' | 'destructive' } {
  if (status === 'active') return { label: 'Active', variant: 'success' }
  if (status === 'expired') return { label: 'Expired', variant: 'destructive' }
  return { label: 'Invited', variant: 'warning' }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatTaskDate(task: CohortTask, noDateLabel: string) {
  // A program assigned with no calendar-enabled pillars/sections gets a
  // dateless placeholder task (see assignProgramToCohort) — nothing to format.
  if (!task.startDate) return noDateLabel
  const start = new Date(`${task.startDate}T00:00:00`)
  const startDay = start.getDate()
  const startMonth = start.toLocaleDateString(undefined, { month: 'short' })
  const startDow = start.toLocaleDateString(undefined, { weekday: 'short' })

  if (!task.endDate || task.endDate === task.startDate) {
    return `${startDay} ${startMonth} (${startDow})`
  }

  const end = new Date(`${task.endDate}T00:00:00`)
  const endDow = end.toLocaleDateString(undefined, { weekday: 'short' })

  if (end.getMonth() === start.getMonth() && end.getFullYear() === start.getFullYear()) {
    return `${startDay}–${end.getDate()} ${startMonth} (${startDow}–${endDow})`
  }
  const endMonth = end.toLocaleDateString(undefined, { month: 'short' })
  return `${startDay} ${startMonth} – ${end.getDate()} ${endMonth} (${startDow}–${endDow})`
}

export default function CohortsPage() {
  const { user } = useAuth()
  const { t } = useTranslation('cohorts')
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCohort, setEditingCohort] = useState<Cohort | null>(null)
  const [agendaCohort, setAgendaCohort] = useState<Cohort | null>(null)
  const confirm = useConfirm()

  const { data: cohortsList = [], isLoading } = useQuery({
    queryKey: ['cohorts'],
    queryFn: async () => (await api.get<Cohort[]>('/api/tenants/me/cohorts')).data,
    enabled: user?.role === 'admin',
  })

  const controls = useListControls(cohortsList, {
    searchFields: (cohort) => [cohort.name],
    statusValue: (cohort) => {
      const today = new Date().toISOString().slice(0, 10)
      return cohort.startDate <= today && today <= cohort.endDate
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/api/tenants/me/cohorts/${id}`)).data,
    onSuccess: () => {
      toast.success(t('toast.deleted'))
      queryClient.invalidateQueries({ queryKey: ['cohorts'] })
    },
    onError: (err) => toast.error(apiError(err, t('toast.deleteFailed'))),
  })

  async function handleDeleteCohort(cohort: Cohort) {
    const ok = await confirm({
      title: t('deleteDialog.title'),
      description: t('deleteDialog.confirm', { name: cohort.name }),
      confirmLabel: t('common:delete'),
      variant: 'destructive',
    })
    if (ok) {
      deleteMutation.mutate(cohort.id)
    }
  }

  if (user?.role !== 'admin') {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        {t('notAvailable')}
      </div>
    )
  }

  function openCreate() {
    setEditingCohort(null)
    setDialogOpen(true)
  }

  function openEdit(cohort: Cohort) {
    setEditingCohort(cohort)
    setDialogOpen(true)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">{t('page.title')}</h1>
          <p className="text-base text-muted-foreground">{t('page.subtitle')}</p>
        </div>
        <button
          onClick={openCreate}
          className="h-11 px-5 bg-primary text-primary-foreground hover:bg-primary/95 text-sm font-bold rounded-lg flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="h-5 w-5" /> {t('page.createButton')}
        </button>
      </div>

      <div className="surface-card overflow-hidden">
        <div className="px-6 py-5 border-b flex items-center gap-3 bg-card">
          <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
            <Users className="h-4.5 w-4.5 text-primary" />
          </div>
          <h2 className="text-lg font-bold text-foreground">{t('table.cardTitle')}</h2>
        </div>
        <div className="px-6 py-4 bg-muted/20 border-b border-border">
          <ListToolbar controls={controls} searchPlaceholder={t('common:search')} activeLabel={t('common:active')} inactiveLabel={t('common:inactive')} />
        </div>
        <div className="sticky top-0 z-10 bg-muted/40 px-6 py-3.5 border-b border-border flex items-center gap-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">
          <div className="w-5 shrink-0" />
          <div className="grid grid-cols-[1.2fr_1fr_1fr_1.5fr_120px] flex-1 min-w-0 gap-4">
            <span>{t('table.name')}</span>
            <span>{t('table.startDate')}</span>
            <span>{t('table.endDate')}</span>
            <span>{t('table.programs')}</span>
            <span className="text-center">{t('table.companies')}</span>
          </div>
          <div className="w-[320px] shrink-0 text-center">{t('common:actions')}</div>
        </div>
        {!isLoading && controls.paged.length === 0 && (
          <div className="text-center py-20">
            <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-base text-muted-foreground font-semibold">{t('table.empty')}</p>
          </div>
        )}
        <div className="divide-y divide-border overflow-y-auto">
          {controls.paged.map((cohort) => (
            <CohortRow
              key={cohort.id}
              cohort={cohort}
              onEdit={() => openEdit(cohort)}
              onDelete={() => handleDeleteCohort(cohort)}
              onViewAgenda={() => setAgendaCohort(cohort)}
            />
          ))}
        </div>
        <div className="px-6 py-4 border-t border-border bg-card">
          <ListPagination controls={controls} />
        </div>
      </div>

      <CohortFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        cohort={editingCohort}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['cohorts'] })}
      />



      <AgendaDialog open={!!agendaCohort} onOpenChange={(open) => !open && setAgendaCohort(null)} cohort={agendaCohort} />
    </div>
  )
}

function CohortFormDialog({
  open,
  onOpenChange,
  cohort,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cohort: Cohort | null
  onSaved: () => void
}) {
  const { t } = useTranslation('cohorts')
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [lastCohortId, setLastCohortId] = useState<number | null | undefined>(undefined)

  const cohortKey = cohort?.id ?? null
  if (open && cohortKey !== lastCohortId) {
    setLastCohortId(cohortKey)
    setName(cohort?.name ?? '')
    setStartDate(cohort?.startDate ?? '')
    setEndDate(cohort?.endDate ?? '')
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const body = { name, startDate, endDate }
      if (cohort) return (await api.patch(`/api/tenants/me/cohorts/${cohort.id}`, body)).data
      return (await api.post('/api/tenants/me/cohorts', body)).data
    },
    onSuccess: () => {
      toast.success(cohort ? t('toast.updated') : t('toast.created'))
      onSaved()
      onOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err, t('toast.saveFailed'))),
  })

  const formValid = name.trim().length > 0 && startDate.length > 0 && endDate.length > 0 && endDate >= startDate

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{cohort ? t('dialog.editTitle') : t('dialog.createTitle')}</DialogTitle>
          <DialogDescription>{t('dialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label required>{t('dialog.nameLabel')}</Label>
            <Input value={name} placeholder={t('dialog.namePlaceholder')} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label required>{t('dialog.startDateLabel')}</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label required>{t('dialog.endDateLabel')}</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          {startDate && endDate && endDate < startDate && (
            <p className="text-xs text-destructive">{t('dialog.dateOrderError')}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:cancel')}
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!formValid || mutation.isPending}>
            {cohort ? t('common:saveChanges') : t('dialog.createButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Cohort row — expands in place to show its companies, no navigation ─────

function CohortRow({
  cohort,
  onEdit,
  onDelete,
  onViewAgenda,
}: {
  cohort: Cohort
  onEdit: () => void
  onDelete: () => void
  onViewAgenda: () => void
}) {
  const { t } = useTranslation('cohorts')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [assignProgramDialogOpen, setAssignProgramDialogOpen] = useState(false)
  const [attachFormDialogOpen, setAttachFormDialogOpen] = useState(false)
  const [assignMentorsDialogOpen, setAssignMentorsDialogOpen] = useState(false)
  const [activeProgramAccess, setActiveProgramAccess] = useState<{ id: number; name: string } | null>(null)

  const releaseProgramMutation = useMutation({
    mutationFn: async (programId: number) => (await api.delete(`/api/tenants/me/programs/${programId}/assign-to-cohort/${cohort.id}`)).data,
    onSuccess: () => {
      toast.success(t('assignProgram.releaseSuccess'))
      queryClient.invalidateQueries({ queryKey: ['cohorts'] })
      queryClient.invalidateQueries({ queryKey: ['cohort-company-progress', cohort.id] })
      setActiveProgramAccess(null)
    },
    onError: (err) => toast.error(apiError(err, t('assignProgram.releaseFailed'))),
  })

  const { data: entries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ['company-entries', { cohortId: cohort.id }],
    queryFn: async () => (await api.get<CompanyEntry[]>(`/api/tenants/me/companies?cohortId=${cohort.id}`)).data,
    enabled: expanded,
  })

  const { data: progress = [] } = useQuery({
    queryKey: ['cohort-company-progress', cohort.id],
    queryFn: async () => (await api.get<CompanyProgress[]>(`/api/tenants/me/cohorts/${cohort.id}/company-progress`)).data,
    enabled: expanded,
  })

  const progressByCompanyId = new Map<number, CompanyProgress[]>()
  for (const p of progress) {
    if (!progressByCompanyId.has(p.companyId)) progressByCompanyId.set(p.companyId, [])
    progressByCompanyId.get(p.companyId)!.push(p)
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((e) => !e)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded((v) => !v) } }}
        className="w-full flex items-center gap-4 px-6 py-4.5 cursor-pointer hover:bg-muted/30 transition-colors"
      >
        <ChevronDown className={cn('h-5 w-5 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
        <div className="grid grid-cols-[1.2fr_1fr_1fr_1.5fr_120px] flex-1 min-w-0 items-center gap-4">
          <span className="text-base font-bold text-foreground truncate" title={cohort.name}>{cohort.name}</span>
          <span className="text-sm font-medium text-muted-foreground truncate">{formatDate(cohort.startDate)}</span>
          <span className="text-sm font-medium text-muted-foreground truncate">{formatDate(cohort.endDate)}</span>
          <div className="flex flex-wrap gap-1.5 min-w-0">
            {cohort.assignedPrograms.length === 0 ? (
              <span className="text-sm text-muted-foreground">—</span>
            ) : (
              cohort.assignedPrograms.map((program) => (
                <button
                  key={program.id}
                  type="button"
                  title={`${program.name} — Click to manage access`}
                  onClick={(e) => { e.stopPropagation(); setActiveProgramAccess(program) }}
                  className="cursor-pointer"
                >
                  <Badge
                    variant="outline"
                    className="max-w-[200px] cursor-pointer whitespace-normal break-words rounded-lg text-left text-xs font-semibold leading-snug hover:bg-muted py-1"
                  >
                    {program.name}
                  </Badge>
                </button>
              ))
            )}
          </div>
          <span className="text-base font-bold text-foreground text-center">{cohort.companyCount}</span>
        </div>
        <div className="flex items-center gap-2 w-[320px] shrink-0 justify-center">
          <button
            type="button"
            className="h-11 w-11 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-xs focus:ring-2 focus:ring-ring"
            title={t('agenda.viewButton')}
            onClick={(e) => { e.stopPropagation(); onViewAgenda() }}
          >
            <CalendarRange className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="h-11 w-11 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-xs focus:ring-2 focus:ring-ring"
            title={t('assignProgram.button')}
            onClick={(e) => { e.stopPropagation(); setAssignProgramDialogOpen(true) }}
          >
            <CalendarPlus className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="h-11 w-11 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-xs focus:ring-2 focus:ring-ring"
            title={t('attachForm.button')}
            onClick={(e) => { e.stopPropagation(); setAttachFormDialogOpen(true) }}
          >
            <FileText className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="h-11 w-11 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-xs focus:ring-2 focus:ring-ring"
            title={t('assignMentors.button')}
            onClick={(e) => { e.stopPropagation(); setAssignMentorsDialogOpen(true) }}
          >
            <UserCog className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="h-11 w-11 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-xs focus:ring-2 focus:ring-ring"
            title={t('common:edit')}
            onClick={(e) => { e.stopPropagation(); onEdit() }}
          >
            <Pencil className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="h-11 w-11 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-muted text-destructive hover:bg-destructive/10 transition-all cursor-pointer shadow-xs focus:ring-2 focus:ring-ring"
            title={t('common:delete')}
            onClick={(e) => { e.stopPropagation(); onDelete() }}
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="bg-muted/30 px-6 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('companies.title')}</h4>
            <Button variant="outline" size="sm" onClick={() => setInviteDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> {t('companies.createButton')}
            </Button>
          </div>

          {entriesLoading ? (
            <p className="text-sm text-muted-foreground py-2">…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">{t('companies.empty')}</p>
          ) : (
            <div className="rounded-lg border bg-background overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('companies.company')}</TableHead>
                    <TableHead>{t('companies.founder')}</TableHead>
                    <TableHead>{t('companies.email')}</TableHead>
                    <TableHead>{t('common:status')}</TableHead>
                    <TableHead>{t('companies.progress')}</TableHead>
                    <TableHead className="text-center">{t('common:actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const badge = statusBadge(entry.status)
                    // Active company entries carry an id like "company-5" (see listCompanyEntries) — extract the numeric id to match progress rows.
                    const companyId = entry.status === 'active' ? Number(entry.id.replace('company-', '')) : NaN
                    const companyProgress = progressByCompanyId.get(companyId) ?? []
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">{entry.name ?? t('companies.pendingCompanyName')}</TableCell>
                        <TableCell>{entry.founderName ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{entry.email}</TableCell>
                        <TableCell>
                          <Badge variant={badge.variant}>{t(`companies.status.${entry.status}`, badge.label)}</Badge>
                        </TableCell>
                        <TableCell>
                          {companyProgress.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <div className="flex flex-col gap-1 items-start">
                              {companyProgress.map((p) => (
                                <Badge key={p.programId} variant={p.completed ? 'success' : 'outline'} className="gap-1 text-[10px] font-normal">
                                  {p.completed ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                                  {p.programName} ({p.completedPillars}/{p.totalPillars}) —{' '}
                                  {p.completed ? t('companies.progressCompleted') : t('companies.progressIncomplete')}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {entry.status === 'active' && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title={t('companies.viewAsFounderButton')}
                              onClick={() => navigate(`/companies/${companyId}/view-as-founder`)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      <CreateCompanyDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        cohortId={cohort.id}
        onInvited={() => {
          queryClient.invalidateQueries({ queryKey: ['company-entries', { cohortId: cohort.id }] })
          queryClient.invalidateQueries({ queryKey: ['cohorts'] })
        }}
      />

      <AssignProgramToCohortDialog open={assignProgramDialogOpen} onOpenChange={setAssignProgramDialogOpen} cohort={cohort} />

      <AttachCohortFormDialog open={attachFormDialogOpen} onOpenChange={setAttachFormDialogOpen} cohort={cohort} />

      <AssignCohortMentorsDialog open={assignMentorsDialogOpen} onOpenChange={setAssignMentorsDialogOpen} cohort={cohort} />

      {activeProgramAccess && (
        <ManageProgramAccessDialog
          open={activeProgramAccess !== null}
          onOpenChange={(open) => !open && setActiveProgramAccess(null)}
          cohort={cohort}
          program={activeProgramAccess}
          companies={entries}
          onReleaseProgram={() => {
            if (activeProgramAccess) {
              releaseProgramMutation.mutate(activeProgramAccess.id)
            }
          }}
          releasePending={releaseProgramMutation.isPending}
        />
      )}
    </div>
  )
}

function AttachCohortFormDialog({
  open,
  onOpenChange,
  cohort,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cohort: Cohort
}) {
  const { t } = useTranslation('cohorts')
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [selectedFormId, setSelectedFormId] = useState('')
  const [fillPolicy, setFillPolicy] = useState<'primary_founder' | 'first_claim'>('primary_founder')

  const { data: attachedForms = [] } = useQuery({
    queryKey: ['cohort-forms', cohort.id],
    queryFn: async () => (await api.get<CohortFormAttachment[]>(`/api/tenants/me/cohorts/${cohort.id}/forms`)).data,
    enabled: open,
  })

  const { data: templatesList = [] } = useQuery({
    queryKey: ['form-templates'],
    queryFn: async () => (await api.get<FormTemplateSummary[]>('/api/tenants/me/form-templates')).data,
    enabled: open,
  })

  const attachedFormIds = new Set(attachedForms.map((f) => f.formId))
  const availableForms = templatesList.filter((f) => !f.isArchived && !f.supersededByFormId && !attachedFormIds.has(f.id))

  const attachMutation = useMutation({
    mutationFn: async () => (await api.post(`/api/tenants/me/cohorts/${cohort.id}/forms`, { formId: Number(selectedFormId), fillPolicy })).data,
    onSuccess: () => {
      toast.success(t('attachForm.attached'))
      queryClient.invalidateQueries({ queryKey: ['cohort-forms', cohort.id] })
      setSelectedFormId('')
    },
    onError: (err) => toast.error(apiError(err, t('attachForm.attachFailed'))),
  })

  const detachMutation = useMutation({
    mutationFn: async (formId: number) => (await api.delete(`/api/tenants/me/cohorts/${cohort.id}/forms/${formId}`)).data,
    onSuccess: () => {
      toast.success(t('attachForm.detached'))
      queryClient.invalidateQueries({ queryKey: ['cohort-forms', cohort.id] })
    },
    onError: (err) => toast.error(apiError(err, t('attachForm.detachFailed'))),
  })

  async function handleDetach(f: CohortFormAttachment) {
    const ok = await confirm({
      title: t('attachForm.detachDialogTitle') || 'Remove Attached Form',
      description: t('attachForm.detachDialogConfirm', { title: f.title }) || `Are you sure you want to remove ${f.title} from this cohort?`,
      confirmLabel: t('common:delete') || 'Delete',
      variant: 'destructive',
    })
    if (ok) {
      detachMutation.mutate(f.formId)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('attachForm.dialogTitle', { name: cohort.name })}</DialogTitle>
          <DialogDescription>{t('attachForm.dialogDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>{t('attachForm.attachedLabel')}</Label>
          {attachedForms.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('attachForm.noneAttached')}</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {attachedForms.map((f) => (
                <div key={f.formId} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{f.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.fillPolicy === 'primary_founder' ? t('attachForm.policyPrimaryFounder') : t('attachForm.policyFirstClaim')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive shrink-0"
                    disabled={detachMutation.isPending}
                    onClick={() => handleDetach(f)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> {t('attachForm.removeButton')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2 border-t pt-3">
          <Label>{t('attachForm.addNewLabel')}</Label>
          {availableForms.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('attachForm.noFormsAvailable')}</p>
          ) : (
            <>
              <Select value={selectedFormId} onValueChange={(v) => setSelectedFormId(v ?? '')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('attachForm.formPlaceholder')}>
                    {(value: string | null) => availableForms.find((f) => String(f.id) === value)?.title ?? t('attachForm.formPlaceholder')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableForms.map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      {f.title}
                      {f.version > 1 ? ` v${f.version}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex flex-col gap-1.5 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={`fillPolicy-${cohort.id}`}
                    checked={fillPolicy === 'primary_founder'}
                    onChange={() => setFillPolicy('primary_founder')}
                    className="accent-primary"
                  />
                  {t('attachForm.policyPrimaryFounder')}
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={`fillPolicy-${cohort.id}`}
                    checked={fillPolicy === 'first_claim'}
                    onChange={() => setFillPolicy('first_claim')}
                    className="accent-primary"
                  />
                  {t('attachForm.policyFirstClaim')}
                </label>
              </div>

              <Button size="sm" disabled={!selectedFormId || attachMutation.isPending} onClick={() => attachMutation.mutate()}>
                <Plus className="h-3.5 w-3.5" /> {t('attachForm.attachButton')}
              </Button>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ScheduledPillar {
  id: number
  title: string
  programName: string
}

interface CohortPillarMentorEntry {
  pillarId: number | null
  pillarTitle: string | null
  mentorUserId: number
  mentorName: string | null
  mentorEmail: string
}

interface EligibleMentorEntry {
  id: number
  name: string | null
  email: string
  specialization: string | null
}

function mentorEntryLabel(mentor: EligibleMentorEntry) {
  const name = mentor.name ?? mentor.email
  return mentor.specialization ? `${name} — ${mentor.specialization}` : name
}

function AssignCohortMentorsDialog({
  open,
  onOpenChange,
  cohort,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cohort: Cohort
}) {
  const { t } = useTranslation('cohorts')
  const queryClient = useQueryClient()
  const [assignments, setAssignments] = useState<Record<number, number | null>>({})
  const [generalMentorId, setGeneralMentorId] = useState<number | null>(null)
  const [initializedFor, setInitializedFor] = useState<number | null>(null)

  const { data: scheduledPillars = [] } = useQuery({
    queryKey: ['cohort-scheduled-pillars', cohort.id],
    queryFn: async () => (await api.get<ScheduledPillar[]>(`/api/tenants/me/cohorts/${cohort.id}/scheduled-pillars`)).data,
    enabled: open,
  })

  const { data: currentMentors = [] } = useQuery({
    queryKey: ['cohort-pillar-mentors', cohort.id],
    queryFn: async () => (await api.get<CohortPillarMentorEntry[]>(`/api/tenants/me/cohorts/${cohort.id}/pillar-mentors`)).data,
    enabled: open,
  })

  const { data: eligibleMentors = [] } = useQuery({
    queryKey: ['mentors-eligible'],
    queryFn: async () => (await api.get<EligibleMentorEntry[]>('/api/tenants/me/mentors/eligible')).data,
    enabled: open,
  })

  // Seed from existing assignments once per open, after that query resolves.
  if (open && initializedFor !== cohort.id && currentMentors.length > 0) {
    setInitializedFor(cohort.id)
    setAssignments(Object.fromEntries(currentMentors.filter((m) => m.pillarId !== null).map((m) => [m.pillarId as number, m.mentorUserId])))
    setGeneralMentorId(currentMentors.find((m) => m.pillarId === null)?.mentorUserId ?? null)
  }

  const mutation = useMutation({
    mutationFn: async () =>
      (
        await api.put(`/api/tenants/me/cohorts/${cohort.id}/pillar-mentors`, {
          assignments: [
            ...Object.entries(assignments)
              .filter(([, mentorUserId]) => mentorUserId !== null)
              .map(([pillarId, mentorUserId]) => ({ pillarId: Number(pillarId) as number | null, mentorUserId: mentorUserId as number })),
            ...(generalMentorId !== null ? [{ pillarId: null, mentorUserId: generalMentorId }] : []),
          ],
        })
      ).data,
    onSuccess: () => {
      toast.success(t('assignMentors.toast.saved'))
      queryClient.invalidateQueries({ queryKey: ['cohort-pillar-mentors', cohort.id] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err, t('assignMentors.toast.saveFailed'))),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setInitializedFor(null)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('assignMentors.dialogTitle', { name: cohort.name })}</DialogTitle>
          <DialogDescription>{t('assignMentors.dialogDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
          <div className="space-y-1 rounded-lg border p-2.5 bg-muted/20">
            <Label className="text-xs text-muted-foreground font-medium">{t('assignMentors.generalMentorLabel')}</Label>
            <Select
              value={generalMentorId ? String(generalMentorId) : ''}
              onValueChange={(v) => setGeneralMentorId(v ? Number(v) : null)}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string | null) => {
                    const mentor = eligibleMentors.find((m) => String(m.id) === value)
                    return mentor ? mentorEntryLabel(mentor) : t('assignMentors.mentorPlaceholder')
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {eligibleMentors.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {mentorEntryLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t('assignMentors.generalMentorHint')}</p>
          </div>

          {scheduledPillars.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('assignMentors.noPillars')}</p>
          ) : (
            scheduledPillars.map((pillar) => (
              <div key={pillar.id} className="space-y-1">
                <Label className="text-xs text-muted-foreground font-medium">
                  {pillar.title} <span className="text-muted-foreground/70">({pillar.programName})</span>
                </Label>
                <Select
                  value={assignments[pillar.id] ? String(assignments[pillar.id]) : ''}
                  onValueChange={(v) => setAssignments((current) => ({ ...current, [pillar.id]: v ? Number(v) : null }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value: string | null) => {
                        const mentor = eligibleMentors.find((m) => String(m.id) === value)
                        return mentor ? mentorEntryLabel(mentor) : t('assignMentors.mentorPlaceholder')
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleMentors.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {mentorEntryLabel(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:cancel')}
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {t('common:saveChanges')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateCompanyDialog({
  open,
  onOpenChange,
  cohortId,
  onInvited,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cohortId: number
  onInvited: () => void
}) {
  const { t } = useTranslation('cohorts')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  function reset() {
    setName('')
    setEmail('')
  }

  const mutation = useMutation({
    mutationFn: async () => (await api.post<CompanyInviteResult>('/api/tenants/me/company-invites', { name, email, cohortId })).data,
    onSuccess: () => {
      toast.success(t('companies.dialog.inviteSent'))
      onInvited()
      onOpenChange(false)
      reset()
    },
    onError: (err) => toast.error(apiError(err, t('companies.dialog.inviteFailed'))),
  })

  const formValid = name.trim().length > 0 && /\S+@\S+\.\S+/.test(email)

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('companies.dialog.title')}</DialogTitle>
          <DialogDescription>{t('companies.dialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label required>{t('companies.dialog.nameLabel')}</Label>
            <Input value={name} placeholder={t('companies.dialog.namePlaceholder')} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label required>{t('companies.dialog.emailLabel')}</Label>
            <Input type="email" value={email} placeholder={t('companies.dialog.emailPlaceholder')} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:cancel')}
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!formValid || mutation.isPending}>
            {t('companies.dialog.sendInviteButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AgendaDialog({
  open,
  onOpenChange,
  cohort,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cohort: Cohort | null
}) {
  const { t } = useTranslation('cohorts')

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['cohort-tasks', cohort?.id],
    queryFn: async () => (await api.get<CohortTask[]>(`/api/tenants/me/cohorts/${cohort!.id}/tasks`)).data,
    enabled: open && cohort !== null,
  })

  // Dateless placeholder tasks (see assignProgramToCohort) sort last, after every dated task.
  const sortedTasks = [...tasks].sort((a, b) => {
    if (!a.startDate && !b.startDate) return 0
    if (!a.startDate) return 1
    if (!b.startDate) return -1
    return a.startDate.localeCompare(b.startDate)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('agenda.dialogTitle', { name: cohort?.name })}</DialogTitle>
          <DialogDescription>{t('agenda.dialogDescription')}</DialogDescription>
        </DialogHeader>

        <div className="rounded-xl bg-slate-900 p-6 max-h-[65vh] overflow-y-auto">
          <h3 className="font-serif text-2xl font-bold text-white">{cohort?.name}</h3>
          {cohort && (
            <p className="text-slate-200 text-sm mt-1 pb-3 border-b border-slate-700">
              {t('agenda.startLabel', { date: formatDate(cohort.startDate) })}
            </p>
          )}

          {isLoading ? (
            <p className="text-slate-400 text-sm py-6 text-center">…</p>
          ) : sortedTasks.length === 0 ? (
            <p className="text-slate-400 text-sm py-6 text-center">{t('agenda.empty')}</p>
          ) : (
            <div className="columns-1 md:columns-2 gap-x-8 mt-4">
              {sortedTasks.map((task) => (
                <div key={task.id} className="break-inside-avoid mb-4">
                  <p className="font-semibold text-slate-100 text-sm">{task.title}</p>
                  <p className="text-slate-300 text-xs mt-0.5">{formatTaskDate(task, t('agenda.noDate'))}</p>
                  {task.description && <p className="text-slate-400 text-xs mt-0.5">{task.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ManageProgramAccessDialog({
  open,
  onOpenChange,
  cohort,
  program,
  companies,
  onReleaseProgram,
  releasePending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cohort: Cohort
  program: { id: number; name: string } | null
  companies: CompanyEntry[]
  onReleaseProgram: () => void
  releasePending: boolean
}) {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const activeCompanies = companies.filter((c) => c.status === 'active')
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('')

  useEffect(() => {
    if (open && activeCompanies.length > 0) {
      setSelectedCompanyId(activeCompanies[0].id)
    } else {
      setSelectedCompanyId('')
    }
  }, [open, companies])

  const numericCompanyId = selectedCompanyId.startsWith('company-')
    ? Number(selectedCompanyId.replace('company-', ''))
    : NaN

  const { data: unlocks = [], refetch: refetchUnlocks } = useQuery({
    queryKey: ['company-unlocks', cohort.id, numericCompanyId],
    queryFn: async () => (await api.get<any[]>(`/api/tenants/me/cohorts/${cohort.id}/companies/${numericCompanyId}/unlocks`)).data,
    enabled: open && !isNaN(numericCompanyId),
  })

  const { data: detail, isLoading: detailLoading, refetch: refetchDetail } = useQuery({
    queryKey: ['company-program-detail', numericCompanyId, program?.id],
    queryFn: async () => (await api.get<any>(`/api/tenants/me/companies/${numericCompanyId}/view-as/programs/${program?.id}`)).data,
    enabled: open && !isNaN(numericCompanyId) && !!program,
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ pillarId, sectionId, unlocked }: { pillarId: number | null; sectionId: number | null; unlocked: boolean }) => {
      await api.post(`/api/tenants/me/cohorts/${cohort.id}/companies/${numericCompanyId}/unlocks`, {
        pillarId,
        sectionId,
        unlocked,
      })
    },
    onSuccess: () => {
      refetchUnlocks()
      refetchDetail()
      queryClient.invalidateQueries({ queryKey: ['cohort-company-progress', cohort.id] })
    },
    onError: (err) => {
      toast.error(apiError(err, 'Failed to update access override'))
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Manage Program Access — {program?.name}</DialogTitle>
          <DialogDescription>
            Configure custom overrides to bypass pillar and section constraints for individual companies in this cohort.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {activeCompanies.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No active companies in this cohort. Custom overrides can only be applied to active companies.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Select Company</Label>
                <Select value={selectedCompanyId} onValueChange={(v) => setSelectedCompanyId(v ?? '')}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {activeCompanies.find((c) => c.id === selectedCompanyId)?.name ?? 'Select Company'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {activeCompanies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="border rounded-lg p-4 bg-muted/20">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Pillars & Sections Access
                </h4>

                {detailLoading ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Loading program structure...</p>
                ) : !detail || detail.pillars.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No program content found.</p>
                ) : (
                  <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                    {detail.pillars.map((pillar: any) => {
                      const isPillarUnlocked = unlocks.some((u: any) => u.pillarId === pillar.id)
                      const isLocked = pillar.locked || pillar.sequenceLocked

                      return (
                        <div key={pillar.id} className="border rounded-lg p-3 bg-background space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-sm">{pillar.title}</p>
                              <div className="flex gap-1.5 mt-0.5">
                                {pillar.locked && (
                                  <Badge variant="secondary" className="text-[9px] uppercase px-1 py-0 font-semibold tracking-wide">
                                    Globally Locked
                                  </Badge>
                                )}
                                {pillar.sequenceLocked && (
                                  <Badge variant="warning" className="text-[9px] uppercase px-1 py-0 font-semibold tracking-wide">
                                    Sequence Locked
                                  </Badge>
                                )}
                                {!pillar.locked && !pillar.sequenceLocked && !isPillarUnlocked && (
                                  <Badge variant="success" className="text-[9px] uppercase px-1 py-0 font-semibold tracking-wide">
                                    Naturally Open
                                  </Badge>
                                )}
                                {isPillarUnlocked && (
                                  <Badge variant="success" className="text-[9px] uppercase px-1 py-0 font-semibold tracking-wide">
                                    Force Unlocked
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {(isLocked || isPillarUnlocked) ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">Force Unlock</span>
                                <Switch
                                  checked={isPillarUnlocked}
                                  onCheckedChange={(checked) =>
                                    toggleMutation.mutate({ pillarId: pillar.id, sectionId: null, unlocked: checked })
                                  }
                                />
                              </div>
                            ) : (
                              <span className="text-xs text-green-600 font-medium">Accessible</span>
                            )}
                          </div>

                          {pillar.sections && pillar.sections.length > 0 && (
                            <div className="ml-4 border-l pl-3 space-y-2 pt-1">
                              {pillar.sections.map((section: any) => {
                                const isSectionUnlocked = unlocks.some((u: any) => u.sectionId === section.id)
                                const isSecLocked = section.locked

                                return (
                                  <div key={section.id} className="flex items-center justify-between gap-3 py-1">
                                    <div>
                                      <p className="text-xs font-medium">{section.title}</p>
                                      <div className="flex gap-1 mt-0.5">
                                        {section.locked && (
                                          <Badge variant="secondary" className="text-[8px] uppercase px-0.5 py-0 font-semibold tracking-wide">
                                            Locked
                                          </Badge>
                                        )}
                                        {!section.locked && !isSectionUnlocked && (
                                          <Badge variant="success" className="text-[8px] uppercase px-0.5 py-0 font-semibold tracking-wide">
                                            Naturally Open
                                          </Badge>
                                        )}
                                        {isSectionUnlocked && (
                                          <Badge variant="success" className="text-[8px] uppercase px-0.5 py-0 font-semibold tracking-wide">
                                            Force Unlocked
                                          </Badge>
                                        )}
                                      </div>
                                    </div>

                                    {(isSecLocked || isSectionUnlocked) ? (
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] text-muted-foreground">Force Unlock</span>
                                        <Switch
                                          size="sm"
                                          checked={isSectionUnlocked}
                                          onCheckedChange={(checked) =>
                                            toggleMutation.mutate({ pillarId: null, sectionId: section.id, unlocked: checked })
                                          }
                                        />
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-green-600 font-medium">Accessible</span>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row sm:justify-between items-center gap-3 border-t pt-4">
          <div>
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 text-xs h-9"
              disabled={releasePending}
              onClick={async () => {
                const ok = await confirm({
                  title: 'Release Program',
                  description: 'Are you sure you want to release this program? All company progress for this program within this cohort will be permanently lost.',
                  confirmLabel: 'Release',
                  variant: 'destructive',
                })
                if (ok) {
                  onReleaseProgram()
                }
              }}
            >
              Release Program
            </Button>
          </div>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
