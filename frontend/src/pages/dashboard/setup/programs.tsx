import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, BookOpen, ChevronDown, GripVertical, FileText, CalendarRange, Info, Target, Layers, TrendingUp, Users, Copy, Lock, Unlock, ArrowDownWideNarrow, GitMerge, ClipboardCheck, type LucideIcon } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Loader } from '@/components/ui/loader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import type {
  Program,
  Pillar,
  PillarDetail,
  PillarSectionRow,
  EntityStatus,
} from '@/types/program'
import type { FormTemplateSummary } from '@/types/forms'
import { AssignProgramToCohortDialog } from '@/components/assign-program-to-cohort-dialog'
import { useListControls } from '@/hooks/use-list-controls'
import { ListToolbar, ListPagination } from '@/components/list-toolbar'
import { useConfirm } from '@/components/confirm-dialog'

import { apiError } from '@/lib/api-error'

// ── Shown instead of the delete-confirm dialog when the target is locked by a cohort assignment ──

function AssignedToCohortDialog({
  open,
  onOpenChange,
  entityLabel,
  cohortNames,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityLabel: string
  cohortNames: string
}) {
  const { t } = useTranslation('program')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('programDetail.assignedBlockDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('programDetail.assignedBlockDialog.description', { entity: entityLabel, cohorts: cohortNames })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{t('programDetail.assignedBlockDialog.closeButton')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function ProgramsPage() {
  const { t } = useTranslation('program')
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProgram, setEditingProgram] = useState<Program | null>(null)
  const [orderedPrograms, setOrderedPrograms] = useState<Program[]>([])
  const confirm = useConfirm()

  const { data: programsList = [], isLoading } = useQuery({
    queryKey: ['programs'],
    queryFn: async () => (await api.get<Program[]>('/api/tenants/me/programs')).data,
  })

  useEffect(() => {
    setOrderedPrograms(programsList)
  }, [programsList])

  const controls = useListControls(orderedPrograms, {
    searchFields: (p) => [p.name, p.description],
    statusValue: (p) => p.status === 'active',
  })
  const canReorder = controls.search.trim() === '' && controls.status === 'all' && controls.pageSize === 'all'

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const reorderMutation = useMutation({
    mutationFn: async (programIds: number[]) => (await api.patch('/api/tenants/me/programs/reorder', { programIds })).data,
    onSuccess: () => toast.success(t('common:orderUpdated')),
    onError: (err) => {
      toast.error(apiError(err, t('programs.toast.reorderFailed')))
      queryClient.invalidateQueries({ queryKey: ['programs'] })
    },
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setOrderedPrograms((current) => {
      const oldIndex = current.findIndex((p) => p.id === active.id)
      const newIndex = current.findIndex((p) => p.id === over.id)
      const next = arrayMove(current, oldIndex, newIndex)
      reorderMutation.mutate(next.map((p) => p.id))
      return next
    })
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/api/tenants/me/programs/${id}`)).data,
    onSuccess: () => {
      toast.success(t('programs.toast.deleted'))
      queryClient.invalidateQueries({ queryKey: ['programs'] })
    },
    onError: (err) => toast.error(apiError(err, t('programs.toast.deleteFailed'))),
  })

  async function handleDeleteProgram(program: Program) {
    let description = t('programs.deleteDialog.confirm', { name: program.name })
    if (program.assignedCohorts.length > 0) {
      description += '\n\n' + t('programs.deleteDialog.cohortWarning', {
        cohorts: program.assignedCohorts.map((c) => c.name).join(', '),
      })
    }
    const ok = await confirm({
      title: t('programs.deleteDialog.title'),
      description,
      confirmLabel: t('common:delete'),
      variant: 'destructive',
    })
    if (ok) {
      deleteMutation.mutate(program.id)
    }
  }

  function openCreate() {
    setEditingProgram(null)
    setDialogOpen(true)
  }

  function openEdit(program: Program) {
    setEditingProgram(program)
    setDialogOpen(true)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('programs.page.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('programs.page.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> {t('programs.page.createButton')}
          </Button>
        </div>
      </div>

      <div className="surface-card">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">{t('programs.table.cardTitle')}</h2>
          {canReorder && orderedPrograms.length > 1 && <span className="text-xs text-muted-foreground font-normal">{t('pillarDetail.dragHint')}</span>}
        </div>
        <div className="px-6 py-3 border-b">
          <ListToolbar controls={controls} searchPlaceholder={t('programs.table.searchPlaceholder')} activeLabel={t('status.active')} inactiveLabel={t('status.inactive')} />
        </div>
        <div className="px-6 py-4 border-b flex items-center gap-3 text-xs font-medium text-muted-foreground">
          <div className="w-4 shrink-0" />
          <div className="h-4 w-4 shrink-0" />
          <div className="grid grid-cols-[1.3fr_1.7fr_1fr_1.6fr] flex-1 min-w-0 gap-3">
            <span>{t('programs.table.name')}</span>
            <span>{t('programs.table.description')}</span>
            <span>{t('programs.table.status')}</span>
            <span>{t('programs.table.assignedToCohort')}</span>
          </div>
          <div className="shrink-0 min-w-[190px] text-center">{t('common:actions')}</div>
        </div>
        {isLoading ? (
          <Loader className="py-10" />
        ) : controls.paged.length === 0 ? (
          <div className="text-center py-10">
            <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {orderedPrograms.length === 0 ? t('programs.table.empty') : t('programs.table.noMatch')}
            </p>
          </div>
        ) : (
          <DndContext sensors={canReorder ? sensors : []} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={controls.paged.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              <div className="divide-y">
                {controls.paged.map((program) => (
                  <ProgramRow
                    key={program.id}
                    program={program}
                    dragEnabled={canReorder}
                    onEdit={() => openEdit(program)}
                    onDelete={() => handleDeleteProgram(program)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
        <div className="px-6 py-3 border-t">
          <ListPagination controls={controls} />
        </div>
      </div>

      <ProgramFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        program={editingProgram}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['programs'] })}
      />


    </div>
  )
}

function ProgramFormDialog({
  open,
  onOpenChange,
  program,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  program: Program | null
  onSaved: () => void
}) {
  const { t } = useTranslation('program')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<EntityStatus>('active')
  const [lastProgramId, setLastProgramId] = useState<number | null | undefined>(undefined)

  const programKey = program?.id ?? null
  if (open && programKey !== lastProgramId) {
    setLastProgramId(programKey)
    setName(program?.name ?? '')
    setDescription(program?.description ?? '')
    setStatus(program?.status ?? 'active')
  }

  function handleOpenChange(next: boolean) {
    // Revert any unsaved edits the instant the dialog closes, rather than waiting for it to reopen.
    if (!next) {
      setName(program?.name ?? '')
      setDescription(program?.description ?? '')
      setStatus(program?.status ?? 'active')
    }
    onOpenChange(next)
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const body = { name, description: description || null, status }
      if (program) return (await api.patch(`/api/tenants/me/programs/${program.id}`, body)).data
      return (await api.post('/api/tenants/me/programs', body)).data
    },
    onSuccess: () => {
      toast.success(program ? t('programs.toast.updated') : t('programs.toast.created'))
      onSaved()
      handleOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err, t('programs.toast.saveFailed'))),
  })

  const formValid = name.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{program ? t('programs.dialog.editTitle') : t('programs.dialog.createTitle')}</DialogTitle>
          <DialogDescription>{t('programs.dialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label required>{t('programs.dialog.nameLabel')}</Label>
            <Input value={name} placeholder={t('programs.dialog.namePlaceholder')} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label>{t('programs.dialog.descriptionLabel')}</Label>
            <Textarea
              value={description}
              placeholder={t('programs.dialog.descriptionPlaceholder')}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('common:status')}</Label>
            <Select value={status} onValueChange={(v) => setStatus((v as EntityStatus) ?? 'active')}>
              <SelectTrigger className="w-full">
                <SelectValue>{(value: string | null) => t(`status.${value ?? 'active'}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t('status.active')}</SelectItem>
                <SelectItem value="inactive">{t('status.inactive')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t('common:cancel')}
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!formValid || mutation.isPending}>
            {program ? t('common:saveChanges') : t('programs.dialog.createButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Program row — expands in place to show its pillars, no navigation ──────

function ProgramRow({
  program,
  dragEnabled,
  onEdit,
  onDelete,
}: {
  program: Program
  dragEnabled: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation('program')
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [pillarDialogOpen, setPillarDialogOpen] = useState(false)
  const [editingPillar, setEditingPillar] = useState<Pillar | null>(null)
  const [assignCohortDialogOpen, setAssignCohortDialogOpen] = useState(false)
  const confirm = useConfirm()
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false)

  const isAssignedToCohort = program.assignedCohorts.length > 0
  const assignedCohortNames = program.assignedCohorts.map((c) => c.name).join(', ')
  const assignedToCohortHint = isAssignedToCohort ? t('programDetail.assignedToCohortHint') : undefined

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: program.id })

  const { data: pillars = [], isLoading: pillarsLoading } = useQuery({
    queryKey: ['pillars', { programId: program.id }],
    queryFn: async () => (await api.get<Pillar[]>(`/api/tenants/me/pillars?programId=${program.id}`)).data,
    enabled: expanded,
  })

  const displayPillars = [...pillars].sort((a, b) => a.sortOrder - b.sortOrder)

  const pillarSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const reorderPillarsMutation = useMutation({
    mutationFn: async (pillarIds: number[]) => (await api.patch('/api/tenants/me/pillars/reorder', { programId: program.id, pillarIds })).data,
    onSuccess: () => {
      toast.success(t('common:orderUpdated'))
      queryClient.invalidateQueries({ queryKey: ['pillars', { programId: program.id }] })
    },
    onError: (err) => {
      toast.error(apiError(err, t('programDetail.reorderPillarsFailed')))
      queryClient.invalidateQueries({ queryKey: ['pillars', { programId: program.id }] })
    },
  })

  function handlePillarDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = displayPillars.findIndex((p) => p.id === active.id)
    const newIndex = displayPillars.findIndex((p) => p.id === over.id)
    reorderPillarsMutation.mutate(arrayMove(displayPillars, oldIndex, newIndex).map((p) => p.id))
  }

  const toggleParallelMutation = useMutation({
    mutationFn: async ({ id, parallelWithPrevious }: { id: number; parallelWithPrevious: boolean }) =>
      (await api.patch(`/api/tenants/me/pillars/${id}`, { parallelWithPrevious })).data,
    onSuccess: () => {
      toast.success(t('common:orderUpdated'))
      queryClient.invalidateQueries({ queryKey: ['pillars', { programId: program.id }] })
    },
    onError: (err) => toast.error(apiError(err, t('programDetail.parallelToggleFailed'))),
  })

  const toggleLockMutation = useMutation({
    mutationFn: async (locked: boolean) => (await api.patch(`/api/tenants/me/programs/${program.id}`, { locked })).data,
    onSuccess: (_data, locked) => {
      toast.success(locked ? t('common:locked') : t('common:unlocked'))
      queryClient.invalidateQueries({ queryKey: ['programs'] })
    },
    onError: (err) => toast.error(apiError(err, t('common:lockToggleFailed'))),
  })

  const deletePillarMutation = useMutation({
    mutationFn: async (pillarId: number) => (await api.delete(`/api/tenants/me/pillars/${pillarId}`)).data,
    onSuccess: () => {
      toast.success(t('programDetail.pillarDeleted'))
      queryClient.invalidateQueries({ queryKey: ['pillars', { programId: program.id }] })
    },
    onError: (err) => toast.error(apiError(err, t('programDetail.pillarDeleteFailed'))),
  })

  async function handleDeletePillar(pillar: Pillar) {
    const ok = await confirm({
      title: t('programDetail.deletePillarTitle'),
      description: t('programDetail.deletePillarConfirm', { title: pillar.title }),
      confirmLabel: t('common:delete'),
      variant: 'destructive',
    })
    if (ok) {
      deletePillarMutation.mutate(pillar.id)
    }
  }

  function openCreatePillar() {
    setEditingPillar(null)
    setPillarDialogOpen(true)
  }

  function openEditPillar(pillar: Pillar) {
    setEditingPillar(pillar)
    setPillarDialogOpen(true)
  }

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn(isDragging && 'relative z-10 opacity-50')}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((e) => !e)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded((v) => !v) } }}
        className="w-full flex items-center gap-3 px-6 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
      >
        <button
          type="button"
          disabled={!dragEnabled}
          {...(dragEnabled ? attributes : {})}
          {...(dragEnabled ? listeners : {})}
          onClick={(e) => e.stopPropagation()}
          title={dragEnabled ? undefined : t('programs.table.reorderDisabledHint')}
          className={cn('w-4 shrink-0 touch-none text-muted-foreground hover:text-foreground', dragEnabled ? 'cursor-grab' : 'cursor-not-allowed opacity-40')}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
        <div className="grid grid-cols-[1.3fr_1.7fr_1fr_1.6fr] flex-1 min-w-0 items-center gap-3">
          <span className="font-medium truncate">{program.name}</span>
          <span className="text-muted-foreground whitespace-normal break-words">{program.description || '—'}</span>
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant={program.status === 'active' ? 'default' : 'secondary'}>{t(`status.${program.status}`)}</Badge>
            {program.locked && <Badge variant="destructive">{t('common:locked')}</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {isAssignedToCohort ? (
              <Badge variant="outline" title={assignedToCohortHint} className="whitespace-normal break-words text-left leading-snug">
                {assignedCohortNames}
              </Badge>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 min-w-[190px] justify-center">
          <Button
            variant="ghost"
            size="icon-sm"
            title={t('programs.assignToCohort.button')}
            onClick={(e) => { e.stopPropagation(); setAssignCohortDialogOpen(true) }}
          >
            <CalendarRange className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" title={t('common:duplicate')} onClick={(e) => { e.stopPropagation(); setDuplicateDialogOpen(true) }}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" title="Feedback form" onClick={(e) => { e.stopPropagation(); setFeedbackDialogOpen(true) }}>
            <ClipboardCheck className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title={program.locked ? t('common:unlock') : t('common:lock')}
            onClick={(e) => { e.stopPropagation(); toggleLockMutation.mutate(!program.locked) }}
          >
            {program.locked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title={isAssignedToCohort ? assignedToCohortHint : t('common:edit')}
            disabled={isAssignedToCohort}
            onClick={(e) => { e.stopPropagation(); onEdit() }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title={t('common:delete')}
            onClick={(e) => { e.stopPropagation(); onDelete() }}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="bg-muted/30 px-6 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('programDetail.pillarsTitle')}</h4>
              {displayPillars.length > 1 && <span className="text-xs text-muted-foreground">{t('pillarDetail.dragHint')}</span>}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={isAssignedToCohort}
              title={isAssignedToCohort ? assignedToCohortHint : undefined}
              onClick={openCreatePillar}
            >
              <Plus className="h-3.5 w-3.5" /> {t('programDetail.createPillarButton')}
            </Button>
          </div>

          {pillarsLoading ? (
            <p className="text-sm text-muted-foreground py-2">…</p>
          ) : displayPillars.length === 0 ? (
            <div className="text-center py-6">
              <Layers className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t('programDetail.noPillars')}</p>
            </div>
          ) : (
            <DndContext sensors={pillarSensors} collisionDetection={closestCenter} onDragEnd={handlePillarDragEnd}>
              <SortableContext items={displayPillars.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                <div>
                  {displayPillars.map((pillar, index) => (
                    <div key={pillar.id} className={index > 0 ? (pillar.parallelWithPrevious ? 'mt-1' : 'mt-3') : undefined}>
                      {pillar.parallelWithPrevious && (
                        <div className="flex items-center gap-2 pl-8 py-1">
                          <div className="w-px self-stretch bg-primary/30" style={{ minHeight: '0.5rem' }} />
                          <span className="flex items-center gap-1 text-[11px] font-medium text-primary">
                            <GitMerge className="h-3 w-3" /> {t('programDetail.parallelGroupConnectorLabel')}
                          </span>
                        </div>
                      )}
                      <PillarCard
                        pillar={pillar}
                        isFirst={index === 0}
                        programLocked={isAssignedToCohort}
                        assignedCohortNames={assignedCohortNames}
                        onEdit={() => openEditPillar(pillar)}
                        onDelete={() => handleDeletePillar(pillar)}
                        onToggleParallel={(parallelWithPrevious) => toggleParallelMutation.mutate({ id: pillar.id, parallelWithPrevious })}
                      />
                    </div>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}

      <PillarFormDialog
        open={pillarDialogOpen}
        onOpenChange={setPillarDialogOpen}
        pillar={editingPillar}
        programId={program.id}
        siblingPillars={displayPillars}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['pillars', { programId: program.id }] })}
      />

      <AssignProgramToCohortDialog open={assignCohortDialogOpen} onOpenChange={setAssignCohortDialogOpen} program={program} />


      <DuplicateProgramDialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
        program={program}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['programs'] })}
      />

      <ProgramFeedbackDialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen} programId={program.id} />


    </div>
  )
}

function DuplicateProgramDialog({
  open,
  onOpenChange,
  program,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  program: Program
  onSaved: () => void
}) {
  const { t } = useTranslation('program')
  const [name, setName] = useState('')
  const [lastProgramId, setLastProgramId] = useState<number | null | undefined>(undefined)

  if (open && program.id !== lastProgramId) {
    setLastProgramId(program.id)
    setName(t('programs.duplicateDialog.defaultName', { name: program.name }))
  } else if (!open && lastProgramId !== undefined) {
    // Closing without saving must not leave stale edits behind — clear the
    // "synced" marker so reopening for the same program re-derives the
    // default name instead of skipping the reset.
    setLastProgramId(undefined)
  }

  const mutation = useMutation({
    mutationFn: async () => (await api.post(`/api/tenants/me/programs/${program.id}/duplicate`, { name })).data,
    onSuccess: () => {
      toast.success(t('programs.duplicateDialog.toast.duplicated'))
      onSaved()
      onOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err, t('programs.duplicateDialog.toast.duplicateFailed'))),
  })

  const formValid = name.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('programs.duplicateDialog.title', { name: program.name })}</DialogTitle>
          <DialogDescription>{t('programs.duplicateDialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label required>{t('programs.dialog.nameLabel')}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:cancel')}
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!formValid || mutation.isPending}>
            {t('programs.duplicateDialog.submitButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ProgramFeedbackMapping {
  id: number
  formTemplateId: number
  mandatory: boolean
  collaborationMode: 'primary_founder' | 'open'
}

function ProgramFeedbackDialog({
  open,
  onOpenChange,
  programId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  programId: number
}) {
  const { t } = useTranslation('program')
  const [formTemplateId, setFormTemplateId] = useState<number | null>(null)
  const [mandatory, setMandatory] = useState(true)
  const [collaborationMode, setCollaborationMode] = useState<'primary_founder' | 'open'>('primary_founder')
  const [initialized, setInitialized] = useState(false)

  const { data: mapping } = useQuery({
    queryKey: ['program-feedback-mapping', programId],
    queryFn: async () => (await api.get<ProgramFeedbackMapping | null>(`/api/programs/${programId}/feedback-mapping`)).data,
    enabled: open,
  })

  const { data: formsList = [] } = useQuery({
    queryKey: ['form-templates'],
    queryFn: async () => (await api.get<FormTemplateSummary[]>('/api/tenants/me/form-templates')).data,
    enabled: open,
  })
  const feedbackForms = formsList.filter((f) => f.category === 'feedback' && !f.isArchived && !f.supersededByFormId)

  if (open && mapping !== undefined && !initialized) {
    setInitialized(true)
    setFormTemplateId(mapping?.formTemplateId ?? null)
    setMandatory(mapping?.mandatory ?? true)
    setCollaborationMode(mapping?.collaborationMode ?? 'primary_founder')
  }

  function handleOpenChange(next: boolean) {
    if (!next) setInitialized(false)
    onOpenChange(next)
  }

  const mutation = useMutation({
    mutationFn: async () =>
      (await api.post(`/api/programs/${programId}/feedback-mapping`, { formTemplateId, mandatory, collaborationMode })).data,
    onSuccess: () => {
      toast.success('Feedback form saved')
      handleOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err, 'Failed to save feedback form')),
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Feedback form</DialogTitle>
          <DialogDescription>
            Founders will be required (or invited, if optional) to fill this in the moment they complete every section of this program.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label required>Form template</Label>
            {feedbackForms.length === 0 ? (
              <p className="text-xs text-muted-foreground">No "Feedback" category form templates exist yet — create one in Assessment Forms first.</p>
            ) : (
              <Select value={formTemplateId ? String(formTemplateId) : ''} onValueChange={(v) => v && setFormTemplateId(Number(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a feedback form">
                    {(value: string | null) => feedbackForms.find((f) => String(f.id) === value)?.title ?? 'Select a feedback form'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {feedbackForms.map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      {f.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <label className="flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={mandatory}
              onChange={(e) => setMandatory(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            />
            <span>
              <span className="block text-sm font-medium">Mandatory</span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                If checked, the popup cannot be dismissed until submitted. If unchecked, founders can skip it.
              </span>
            </span>
          </label>

          <div className="space-y-1.5">
            <Label>Who can fill it</Label>
            <Select value={collaborationMode} onValueChange={(v) => v && setCollaborationMode(v as 'primary_founder' | 'open')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="primary_founder">Restricted — only the original signup founder</SelectItem>
                <SelectItem value="open">Open — any founder on the company</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">A mentor assigned to the company's cohort can always fill it too.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t('common:cancel')}
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!formTemplateId || mutation.isPending}>
            {t('common:saveChanges')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Pillar card — expands in place to show its sections ────────────────────

function SortableSectionRow({
  section,
  programLocked,
  assignedCohortNames,
  onEdit,
  onDelete,
  onAssignForm,
  onToggleLock,
}: {
  section: PillarSectionRow
  programLocked: boolean
  assignedCohortNames: string
  onEdit: () => void
  onDelete: () => void
  onAssignForm: () => void
  onToggleLock: (locked: boolean) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.sectionId })
  const { t } = useTranslation('program')
  const [showAssignedInfo, setShowAssignedInfo] = useState(false)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex items-center gap-3 rounded-lg border bg-background px-3 py-2', isDragging && 'opacity-50')}
    >
      <button
        type="button"
        disabled={programLocked}
        {...(programLocked ? {} : attributes)}
        {...(programLocked ? {} : listeners)}
        title={programLocked ? t('programDetail.assignedToCohortHint') : undefined}
        className={cn('text-muted-foreground hover:text-foreground touch-none', programLocked ? 'cursor-not-allowed opacity-50' : 'cursor-grab')}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium">{section.title}</span>
        {section.forms.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap mt-0.5">
            {section.forms.map((form) => (
              <Badge key={form.id} variant="outline" className="text-[10px] font-normal">
                {form.name}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <Badge variant={section.status === 'active' ? 'default' : 'secondary'}>{t(`status.${section.status}`)}</Badge>
      {section.locked && <Badge variant="destructive">{t('common:locked')}</Badge>}
      <Button
        variant="ghost"
        size="icon-sm"
        title={programLocked ? t('programDetail.assignedToCohortHint') : t('programDetail.assignFormButton')}
        disabled={programLocked}
        onClick={onAssignForm}
      >
        <FileText className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon-sm" title={section.locked ? t('common:unlock') : t('common:lock')} onClick={() => onToggleLock(!section.locked)}>
        {section.locked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        title={programLocked ? t('programDetail.assignedToCohortHint') : t('common:edit')}
        disabled={programLocked}
        onClick={onEdit}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        title={t('common:delete')}
        onClick={() => { if (programLocked) setShowAssignedInfo(true); else onDelete() }}
      >
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>

      <AssignedToCohortDialog
        open={showAssignedInfo}
        onOpenChange={setShowAssignedInfo}
        entityLabel={t('programDetail.entityLabels.section')}
        cohortNames={assignedCohortNames}
      />
    </div>
  )
}

function PillarCard({
  pillar,
  isFirst,
  programLocked,
  assignedCohortNames,
  onEdit,
  onDelete,
  onToggleParallel,
}: {
  pillar: Pillar
  isFirst: boolean
  programLocked: boolean
  assignedCohortNames: string
  onEdit: () => void
  onDelete: () => void
  onToggleParallel: (parallelWithPrevious: boolean) => void
}) {
  const { t } = useTranslation('program')
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [showAssignedInfo, setShowAssignedInfo] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [orderedSections, setOrderedSections] = useState<PillarSectionRow[]>([])
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false)
  const [editingSection, setEditingSection] = useState<PillarSectionRow | null>(null)
  const [assigningFormSection, setAssigningFormSection] = useState<PillarSectionRow | null>(null)
  const confirm = useConfirm()

  const { attributes: pillarAttributes, listeners: pillarListeners, setNodeRef: setPillarNodeRef, transform: pillarTransform, transition: pillarTransition, isDragging: isPillarDragging } = useSortable({ id: pillar.id })

  const { data: detail } = useQuery({
    queryKey: ['pillar', pillar.id],
    queryFn: async () => (await api.get<PillarDetail>(`/api/tenants/me/pillars/${pillar.id}`)).data,
    enabled: expanded,
  })

  useEffect(() => {
    if (detail) setOrderedSections(detail.sections)
  }, [detail])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const reorderMutation = useMutation({
    mutationFn: async (sectionIds: number[]) =>
      (await api.patch(`/api/tenants/me/pillars/${pillar.id}/sections/reorder`, { sectionIds })).data,
    onSuccess: () => toast.success(t('common:orderUpdated')),
    onError: (err) => {
      toast.error(apiError(err, t('programDetail.reorderFailed')))
      queryClient.invalidateQueries({ queryKey: ['pillar', pillar.id] })
    },
  })

  const deleteSectionMutation = useMutation({
    mutationFn: async (sectionId: number) => (await api.delete(`/api/tenants/me/sections/${sectionId}`)).data,
    onSuccess: () => {
      toast.success(t('programDetail.sectionDeleted'))
      queryClient.invalidateQueries({ queryKey: ['pillar', pillar.id] })
    },
    onError: (err) => toast.error(apiError(err, t('programDetail.sectionDeleteFailed'))),
  })

  async function handleDeleteSection(section: PillarSectionRow) {
    const ok = await confirm({
      title: t('programDetail.deleteSectionTitle'),
      description: t('programDetail.deleteSectionConfirm', { title: section.title }),
      confirmLabel: t('common:delete'),
      variant: 'destructive',
    })
    if (ok) {
      deleteSectionMutation.mutate(section.sectionId)
    }
  }

  const togglePillarLockMutation = useMutation({
    mutationFn: async (locked: boolean) => (await api.patch(`/api/tenants/me/pillars/${pillar.id}`, { locked })).data,
    onSuccess: (_data, locked) => {
      toast.success(locked ? t('common:locked') : t('common:unlocked'))
      queryClient.invalidateQueries({ queryKey: ['pillars', { programId: pillar.programId }] })
    },
    onError: (err) => toast.error(apiError(err, t('common:lockToggleFailed'))),
  })

  const toggleSectionLockMutation = useMutation({
    mutationFn: async (params: { sectionId: number; locked: boolean }) =>
      (await api.patch(`/api/tenants/me/sections/${params.sectionId}`, { locked: params.locked })).data,
    onSuccess: (_data, params) => {
      toast.success(params.locked ? t('common:locked') : t('common:unlocked'))
      queryClient.invalidateQueries({ queryKey: ['pillar', pillar.id] })
    },
    onError: (err) => toast.error(apiError(err, t('common:lockToggleFailed'))),
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setOrderedSections((current) => {
      const oldIndex = current.findIndex((s) => s.sectionId === active.id)
      const newIndex = current.findIndex((s) => s.sectionId === over.id)
      const next = arrayMove(current, oldIndex, newIndex)
      reorderMutation.mutate(next.map((s) => s.sectionId))
      return next
    })
  }

  function openCreateSection() {
    setEditingSection(null)
    setSectionDialogOpen(true)
  }

  function openEditSection(section: PillarSectionRow) {
    setEditingSection(section)
    setSectionDialogOpen(true)
  }

  return (
    <div
      ref={setPillarNodeRef}
      style={{ transform: CSS.Transform.toString(pillarTransform), transition: pillarTransition }}
      className={cn(
        'rounded-xl border bg-card p-4 space-y-3 shadow-xs transition-shadow hover:shadow-sm',
        pillar.parallelWithPrevious && 'border-primary/30',
        isPillarDragging && 'relative z-10 opacity-50 shadow-md',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('programDetail.executionModeLabel')}</span>
        <div className="inline-flex rounded-full border bg-muted/40 p-0.5 text-xs">
          <button
            type="button"
            disabled={isFirst || programLocked}
            onClick={() => onToggleParallel(false)}
            title={programLocked ? t('programDetail.assignedToCohortHint') : isFirst ? t('programDetail.executionModeFirstPillarHint') : undefined}
            className={cn(
              'flex items-center gap-1 rounded-full px-2.5 py-1 font-medium transition-colors',
              !pillar.parallelWithPrevious ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              (isFirst || programLocked) && 'cursor-not-allowed opacity-60',
            )}
          >
            <ArrowDownWideNarrow className="h-3 w-3" />
            {t('programDetail.sequentialOption')}
          </button>
          <button
            type="button"
            disabled={isFirst || programLocked}
            onClick={() => onToggleParallel(true)}
            title={programLocked ? t('programDetail.assignedToCohortHint') : isFirst ? t('programDetail.executionModeFirstPillarHint') : undefined}
            className={cn(
              'flex items-center gap-1 rounded-full px-2.5 py-1 font-medium transition-colors',
              pillar.parallelWithPrevious ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              (isFirst || programLocked) && 'cursor-not-allowed opacity-60',
            )}
          >
            <GitMerge className="h-3 w-3" />
            {t('programDetail.parallelOption')}
          </button>
        </div>
      </div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((e) => !e)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded((v) => !v) } }}
        className="w-full flex items-start justify-between gap-3 text-left cursor-pointer"
      >
        <div className="flex items-start gap-2 min-w-0">
          <button
            type="button"
            disabled={programLocked}
            {...(programLocked ? {} : pillarAttributes)}
            {...(programLocked ? {} : pillarListeners)}
            onClick={(e) => e.stopPropagation()}
            title={programLocked ? t('programDetail.assignedToCohortHint') : undefined}
            className={cn('text-muted-foreground hover:text-foreground touch-none mt-1 shrink-0', programLocked ? 'cursor-not-allowed opacity-50' : 'cursor-grab')}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <ChevronDown className={cn('h-4 w-4 mt-1.5 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-1.5">
              <h3 className="font-semibold text-base truncate">{pillar.title}</h3>
              <Badge variant={pillar.status === 'active' ? 'default' : 'secondary'}>{t(`status.${pillar.status}`)}</Badge>
              {pillar.purpose === 'assessment' && (
                <Badge variant="warning">
                  {pillar.passThreshold !== null
                    ? t('pillars.dialog.assessmentBadge', { threshold: pillar.passThreshold })
                    : t('pillars.dialog.assessmentBadgeNoThreshold')}
                </Badge>
              )}
              {pillar.purpose === 'assessment' && !pillar.mandatory && (
                <Badge variant="success">
                  {t('pillars.dialog.skippableBadge')}
                </Badge>
              )}
              {pillar.locked && <Badge variant="destructive">{t('common:locked')}</Badge>}
              {pillar.parallelWithPrevious && (
                <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
                  <GitMerge className="h-3 w-3" /> {t('programDetail.parallelBadge')}
                </Badge>
              )}
            </div>
            {pillar.description && (
              <div className="mt-1.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('pillars.dialog.descriptionLabel')}</p>
                <p className="text-sm text-foreground/80 mt-0.5">{pillar.description}</p>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setDetailsOpen(true) }}>
            <Info className="h-3.5 w-3.5" /> {t('programDetail.viewInfoButton')}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title={pillar.locked ? t('common:unlock') : t('common:lock')}
            onClick={(e) => { e.stopPropagation(); togglePillarLockMutation.mutate(!pillar.locked) }}
          >
            {pillar.locked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title={programLocked ? t('programDetail.assignedToCohortHint') : t('common:edit')}
            disabled={programLocked}
            onClick={(e) => { e.stopPropagation(); onEdit() }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title={t('common:delete')}
            onClick={(e) => { e.stopPropagation(); if (programLocked) setShowAssignedInfo(true); else onDelete() }}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('programDetail.sectionsTitle')}</h4>
              {orderedSections.length > 0 && <span className="text-xs text-muted-foreground">{t('pillarDetail.dragHint')}</span>}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={programLocked}
              title={programLocked ? t('programDetail.assignedToCohortHint') : undefined}
              onClick={openCreateSection}
            >
              <Plus className="h-3.5 w-3.5" /> {t('programDetail.createSectionButton')}
            </Button>
          </div>

          {orderedSections.length === 0 ? (
            <div className="text-center py-6">
              <FileText className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t('programDetail.noSections')}</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={orderedSections.map((s) => s.sectionId)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {orderedSections.map((section) => (
                    <SortableSectionRow
                      key={section.sectionId}
                      section={section}
                      programLocked={programLocked}
                      assignedCohortNames={assignedCohortNames}
                      onEdit={() => openEditSection(section)}
                      onDelete={() => handleDeleteSection(section)}
                      onAssignForm={() => setAssigningFormSection(section)}
                      onToggleLock={(locked) => toggleSectionLockMutation.mutate({ sectionId: section.sectionId, locked })}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}

      <PillarDetailsDialog open={detailsOpen} onOpenChange={setDetailsOpen} pillar={pillar} onEdit={onEdit} />

      <SectionFormDialog
        open={sectionDialogOpen}
        onOpenChange={setSectionDialogOpen}
        section={editingSection}
        pillarId={pillar.id}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['pillar', pillar.id] })}
      />

      <AssignFormDialog
        open={!!assigningFormSection}
        onOpenChange={(open) => !open && setAssigningFormSection(null)}
        section={assigningFormSection}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['pillar', pillar.id] })}
      />

      <AssignedToCohortDialog
        open={showAssignedInfo}
        onOpenChange={setShowAssignedInfo}
        entityLabel={t('programDetail.entityLabels.pillar')}
        cohortNames={assignedCohortNames}
      />


    </div>
  )
}

function PillarDetailsDialog({
  open,
  onOpenChange,
  pillar,
  onEdit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pillar: Pillar
  onEdit: () => void
}) {
  const { t } = useTranslation('program')

  // Monochrome by design — differentiated by icon, not color (see index.css).
  const fields: { label: string; value: string | null; icon: LucideIcon; accent: string }[] = [
    {
      label: t('pillars.dialog.programObjectiveLabel'),
      value: pillar.programObjective,
      icon: Target,
      accent: 'bg-primary/10 text-primary',
    },
    {
      label: t('pillars.dialog.phaseCoverageLabel'),
      value: pillar.phaseCoverage,
      icon: Layers,
      accent: 'bg-primary/10 text-primary',
    },
    {
      label: t('pillars.dialog.expectedOutcomesLabel'),
      value: pillar.expectedOutcomes,
      icon: TrendingUp,
      accent: 'bg-primary/10 text-primary',
    },
    {
      label: t('pillars.dialog.founderExpectationLabel'),
      value: pillar.founderExpectation,
      icon: Users,
      accent: 'bg-primary/10 text-primary',
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <BookOpen className="h-4 w-4 text-primary" />
            </div>
            <DialogTitle>{pillar.title}</DialogTitle>
            <Badge variant={pillar.status === 'active' ? 'default' : 'secondary'}>{t(`status.${pillar.status}`)}</Badge>
          </div>
          {pillar.description && (
            <DialogDescription className="pl-[42px]">
              <span className="font-medium text-foreground">{t('pillars.dialog.descriptionLabel')}: </span>
              {pillar.description}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-2.5 max-h-[65vh] overflow-y-auto pr-1">
          {fields.map((field) => (
            <div key={field.label} className="flex gap-3 rounded-xl border bg-muted/30 p-3">
              <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', field.accent)}>
                <field.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{field.label}</p>
                <p className="text-sm mt-0.5 whitespace-pre-wrap">{field.value || '—'}</p>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:close')}
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false)
              onEdit()
            }}
          >
            {t('common:edit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const INSERT_AT_END = '__end__'

function PillarFormDialog({
  open,
  onOpenChange,
  pillar,
  programId,
  siblingPillars,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pillar: Pillar | null
  programId: number
  siblingPillars: Pillar[]
  onSaved: () => void
}) {
  const { t } = useTranslation('program')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [programObjective, setProgramObjective] = useState('')
  const [phaseCoverage, setPhaseCoverage] = useState('')
  const [expectedOutcomes, setExpectedOutcomes] = useState('')
  const [founderExpectation, setFounderExpectation] = useState('')
  const [status, setStatus] = useState<EntityStatus>('active')
  const [purpose, setPurpose] = useState<'learning' | 'assessment'>('learning')
  const [passThreshold, setPassThreshold] = useState('')
  const [mandatory, setMandatory] = useState(true)
  const [insertAfterPillarId, setInsertAfterPillarId] = useState(INSERT_AT_END)
  const [showInCalendar, setShowInCalendar] = useState(false)
  const [hasReadinessChecklist, setHasReadinessChecklist] = useState(false)
  const [hasKeyTakeawaysAndDiscussions, setHasKeyTakeawaysAndDiscussions] = useState(true)
  const [checklistQuestions, setChecklistQuestions] = useState<Array<{ prompt: string; type: 'text' | 'checkbox' }>>([])
  const [lastPillarId, setLastPillarId] = useState<number | null | undefined>(undefined)

  const pillarKey = pillar?.id ?? null
  if (open && pillarKey !== lastPillarId) {
    setLastPillarId(pillarKey)
    setTitle(pillar?.title ?? '')
    setDescription(pillar?.description ?? '')
    setProgramObjective(pillar?.programObjective ?? '')
    setPhaseCoverage(pillar?.phaseCoverage ?? '')
    setExpectedOutcomes(pillar?.expectedOutcomes ?? '')
    setFounderExpectation(pillar?.founderExpectation ?? '')
    setStatus(pillar?.status ?? 'active')
    setPurpose(pillar?.purpose ?? 'learning')
    setPassThreshold(pillar?.passThreshold != null ? String(pillar.passThreshold) : '')
    setMandatory(pillar?.mandatory ?? true)
    setInsertAfterPillarId(INSERT_AT_END)
    setShowInCalendar(pillar?.showInCalendar ?? false)
    setHasReadinessChecklist(pillar?.hasReadinessChecklist ?? false)
    setHasKeyTakeawaysAndDiscussions(pillar?.hasKeyTakeawaysAndDiscussions ?? true)
    setChecklistQuestions([])
  } else if (!open && lastPillarId !== undefined) {
    // Closing without saving (Cancel/X/outside-click) must not leave stale
    // edits behind — clear the "synced" marker so reopening (even a fresh
    // Create dialog, where pillarKey is null both times) re-derives from
    // `pillar` above instead of skipping the reset.
    setLastPillarId(undefined)
  }

  // Existing checklist questions live on the full pillar detail (not the list-row `pillar` prop) —
  // fetched only while editing a pillar that already has the checklist enabled.
  const { data: pillarDetail } = useQuery({
    queryKey: ['pillar-detail-for-checklist', pillar?.id],
    queryFn: async () => (await api.get<PillarDetail>(`/api/tenants/me/pillars/${pillar!.id}`)).data,
    enabled: open && !!pillar?.hasReadinessChecklist,
  })
  const [checklistSeededFor, setChecklistSeededFor] = useState<number | null>(null)
  if (pillarDetail && checklistSeededFor !== pillarDetail.id) {
    setChecklistSeededFor(pillarDetail.id)
    setChecklistQuestions(pillarDetail.checklistQuestions.map((q) => ({ prompt: q.prompt, type: q.type })))
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        title,
        description: description || null,
        programObjective: programObjective || null,
        phaseCoverage: phaseCoverage || null,
        expectedOutcomes: expectedOutcomes || null,
        founderExpectation: founderExpectation || null,
        programId,
        status,
        purpose,
        passThreshold: purpose === 'assessment' && passThreshold !== '' ? Number(passThreshold) : null,
        mandatory: purpose === 'assessment' ? mandatory : true,
        showInCalendar,
        hasReadinessChecklist,
        hasKeyTakeawaysAndDiscussions,
        ...(!pillar && purpose === 'assessment' && insertAfterPillarId !== INSERT_AT_END ? { insertAfterPillarId: Number(insertAfterPillarId) } : {}),
      }
      const saved: { id: number } = pillar
        ? (await api.patch(`/api/tenants/me/pillars/${pillar.id}`, body)).data
        : (await api.post('/api/tenants/me/pillars', body)).data
      if (hasReadinessChecklist) {
        await api.put(`/api/tenants/me/pillars/${saved.id}/checklist-questions`, {
          questions: checklistQuestions.filter((q) => q.prompt.trim().length > 0),
        })
      }
      return saved
    },
    onSuccess: () => {
      toast.success(pillar ? t('programDetail.pillarUpdated') : t('programDetail.pillarCreated'))
      onSaved()
      onOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err, t('programDetail.pillarSaveFailed'))),
  })

  const formValid = pillar
    ? title.trim().length > 0
    : title.trim().length > 0 &&
      programObjective.trim().length > 0 &&
      phaseCoverage.trim().length > 0 &&
      expectedOutcomes.trim().length > 0 &&
      founderExpectation.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{pillar ? t('programDetail.editPillarTitle') : t('programDetail.createPillarTitle')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label required>{t('pillars.dialog.titleLabel')}</Label>
            <Input value={title} placeholder={t('pillars.dialog.titlePlaceholder')} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label required>{t('pillars.dialog.purposeLabel')}</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['learning', 'assessment'] as const).map((option) => (
                <label
                  key={option}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer text-sm',
                    purpose === option ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                  )}
                >
                  <input
                    type="radio"
                    name="pillar-purpose"
                    checked={purpose === option}
                    onChange={() => setPurpose(option)}
                    className="h-4 w-4 shrink-0 accent-primary"
                  />
                  {t(`pillars.dialog.${option}Option`)}
                </label>
              ))}
            </div>
            {purpose === 'assessment' && (
              <div className="space-y-4 pt-1">
                <div className="space-y-1">
                  <Label>{t('pillars.dialog.passThresholdLabel')}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="w-32"
                    value={passThreshold}
                    onChange={(e) => setPassThreshold(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{t('pillars.dialog.passThresholdHint')}</p>
                </div>

                <div className="space-y-1.5">
                  <Label>{t('pillars.dialog.attendanceLabel')}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {([true, false] as const).map((option) => (
                      <label
                        key={String(option)}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer text-sm',
                          mandatory === option ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                        )}
                      >
                        <input
                          type="radio"
                          name="pillar-mandatory"
                          checked={mandatory === option}
                          onChange={() => setMandatory(option)}
                          className="h-4 w-4 shrink-0 accent-primary"
                        />
                        {t(option ? 'pillars.dialog.mandatoryOption' : 'pillars.dialog.skippableOption')}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{t('pillars.dialog.attendanceHint')}</p>
                </div>

                {!pillar && siblingPillars.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>{t('pillars.dialog.insertAfterLabel')}</Label>
                    <Select value={insertAfterPillarId} onValueChange={(v) => setInsertAfterPillarId(v ?? INSERT_AT_END)}>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(value: string | null) => siblingPillars.find((p) => String(p.id) === value)?.title ?? t('pillars.dialog.insertAtEndOption')}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={INSERT_AT_END}>{t('pillars.dialog.insertAtEndOption')}</SelectItem>
                        {siblingPillars.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>{t('pillars.dialog.descriptionLabel')}</Label>
            <Textarea
              value={description}
              placeholder={t('pillars.dialog.descriptionPlaceholder')}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label required={!pillar}>{t('pillars.dialog.programObjectiveLabel')}</Label>
            <Textarea
              value={programObjective}
              placeholder={t('pillars.dialog.programObjectivePlaceholder')}
              onChange={(e) => setProgramObjective(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label required={!pillar}>{t('pillars.dialog.phaseCoverageLabel')}</Label>
            <Textarea
              value={phaseCoverage}
              placeholder={t('pillars.dialog.phaseCoveragePlaceholder')}
              onChange={(e) => setPhaseCoverage(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label required={!pillar}>{t('pillars.dialog.expectedOutcomesLabel')}</Label>
            <Textarea
              value={expectedOutcomes}
              placeholder={t('pillars.dialog.expectedOutcomesPlaceholder')}
              onChange={(e) => setExpectedOutcomes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label required={!pillar}>{t('pillars.dialog.founderExpectationLabel')}</Label>
            <Textarea
              value={founderExpectation}
              placeholder={t('pillars.dialog.founderExpectationPlaceholder')}
              onChange={(e) => setFounderExpectation(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('common:status')}</Label>
            <Select value={status} onValueChange={(v) => setStatus((v as EntityStatus) ?? 'active')}>
              <SelectTrigger className="w-full">
                <SelectValue>{(value: string | null) => t(`status.${value ?? 'active'}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t('status.active')}</SelectItem>
                <SelectItem value="inactive">{t('status.inactive')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={showInCalendar}
              onChange={(e) => setShowInCalendar(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            />
            <span>
              <span className="block text-sm font-medium">{t('pillars.dialog.showInCalendarLabel')}</span>
              <span className="block text-xs text-muted-foreground mt-0.5">{t('pillars.dialog.showInCalendarHelp')}</span>
            </span>
          </label>

          <label className="flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={hasKeyTakeawaysAndDiscussions}
              onChange={(e) => setHasKeyTakeawaysAndDiscussions(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            />
            <span>
              <span className="block text-sm font-medium">{t('pillars.dialog.takeawaysAndDiscussionsLabel')}</span>
              <span className="block text-xs text-muted-foreground mt-0.5">{t('pillars.dialog.takeawaysAndDiscussionsHelp')}</span>
            </span>
          </label>

          <div className="space-y-2">
            <label className="flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={hasReadinessChecklist}
                onChange={(e) => setHasReadinessChecklist(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
              />
              <span>
                <span className="block text-sm font-medium">{t('pillars.dialog.checklistLabel')}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">{t('pillars.dialog.checklistHelp')}</span>
              </span>
            </label>

            {hasReadinessChecklist && (
              <div className="space-y-2 rounded-lg border p-3">
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {checklistQuestions.map((q, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="flex-1 space-y-1.5">
                        <Input
                          value={q.prompt}
                          placeholder={t('pillars.dialog.checklistQuestionPlaceholder')}
                          onChange={(e) =>
                            setChecklistQuestions((qs) => qs.map((row, idx) => (idx === i ? { ...row, prompt: e.target.value } : row)))
                          }
                        />
                        <Select
                          value={q.type}
                          onValueChange={(v) =>
                            setChecklistQuestions((qs) => qs.map((row, idx) => (idx === i ? { ...row, type: (v as 'text' | 'checkbox') ?? 'text' } : row)))
                          }
                        >
                          <SelectTrigger className="w-full h-8 text-xs">
                            <SelectValue>{(value: string | null) => t(value === 'checkbox' ? 'pillars.dialog.checklistCheckboxOption' : 'pillars.dialog.checklistTextOption')}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">{t('pillars.dialog.checklistTextOption')}</SelectItem>
                            <SelectItem value="checkbox">{t('pillars.dialog.checklistCheckboxOption')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="mt-0.5"
                        onClick={() => setChecklistQuestions((qs) => qs.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setChecklistQuestions((qs) => [...qs, { prompt: '', type: 'text' }])}
                >
                  <Plus className="h-3.5 w-3.5" /> {t('pillars.dialog.checklistAddQuestionButton')}
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:cancel')}
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!formValid || mutation.isPending}>
            {pillar ? t('common:saveChanges') : t('programDetail.createPillarButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SectionFormDialog({
  open,
  onOpenChange,
  section,
  pillarId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  section: PillarSectionRow | null
  pillarId: number
  onSaved: () => void
}) {
  const { t } = useTranslation('program')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<EntityStatus>('active')
  const [showInCalendar, setShowInCalendar] = useState(false)
  const [lastSectionId, setLastSectionId] = useState<number | null | undefined>(undefined)

  if (open && (section?.sectionId ?? null) !== lastSectionId) {
    setLastSectionId(section?.sectionId ?? null)
    setTitle(section?.title ?? '')
    setDescription(section?.description ?? '')
    setStatus(section?.status ?? 'active')
    setShowInCalendar(section?.showInCalendar ?? false)
  } else if (!open && lastSectionId !== undefined) {
    // Closing without saving must not leave stale edits behind — clear the
    // "synced" marker so reopening (even a fresh Create dialog, where the key
    // is null both times) re-derives from `section` above instead of skipping
    // the reset.
    setLastSectionId(undefined)
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const body = { title, description: description || null, status, showInCalendar }
      if (section) return (await api.patch(`/api/tenants/me/sections/${section.sectionId}`, body)).data
      return (await api.post('/api/tenants/me/sections', { ...body, pillarId })).data
    },
    onSuccess: () => {
      toast.success(section ? t('programDetail.sectionUpdated') : t('programDetail.sectionCreated'))
      onSaved()
      onOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err, t('programDetail.sectionSaveFailed'))),
  })

  const formValid = title.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{section ? t('programDetail.editSectionTitle') : t('programDetail.createSectionTitle')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label required>{t('sections.dialog.titleLabel')}</Label>
            <Input value={title} placeholder={t('sections.dialog.titlePlaceholder')} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label>{t('sections.dialog.descriptionLabel')}</Label>
            <Textarea
              value={description}
              placeholder={t('sections.dialog.descriptionPlaceholder')}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('common:status')}</Label>
            <Select value={status} onValueChange={(v) => setStatus((v as EntityStatus) ?? 'active')}>
              <SelectTrigger className="w-full">
                <SelectValue>{(value: string | null) => t(`status.${value ?? 'active'}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t('status.active')}</SelectItem>
                <SelectItem value="inactive">{t('status.inactive')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={showInCalendar}
              onChange={(e) => setShowInCalendar(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            />
            <span>
              <span className="block text-sm font-medium">{t('sections.dialog.showInCalendarLabel')}</span>
              <span className="block text-xs text-muted-foreground mt-0.5">{t('sections.dialog.showInCalendarHelp')}</span>
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:cancel')}
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!formValid || mutation.isPending}>
            {section ? t('common:saveChanges') : t('programDetail.createSectionButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AssignFormDialog({
  open,
  onOpenChange,
  section,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  section: PillarSectionRow | null
  onSaved: () => void
}) {
  const { t } = useTranslation('program')
  // Maps formId -> fillPolicy for every currently-checked form — unchecked
  // forms simply have no entry. New checks default to 'first_claim' (any
  // team member, first to save locks the rest out — the column default).
  const [selectedForms, setSelectedForms] = useState<Record<number, 'primary_founder' | 'first_claim'>>({})
  const [lastSectionId, setLastSectionId] = useState<number | null | undefined>(undefined)

  const sectionKey = section?.sectionId ?? null
  if (open && sectionKey !== lastSectionId) {
    setLastSectionId(sectionKey)
    setSelectedForms(Object.fromEntries((section?.forms ?? []).map((f) => [f.id, f.fillPolicy])))
  } else if (!open && lastSectionId !== undefined) {
    // Closing without saving (Cancel/X/outside-click) must not leave stale checkbox
    // edits behind — clear the "synced" marker so reopening re-derives from `section.forms`.
    setLastSectionId(undefined)
  }

  const { data: formsList = [] } = useQuery({
    queryKey: ['form-templates'],
    queryFn: async () => (await api.get<FormTemplateSummary[]>('/api/tenants/me/form-templates')).data,
    enabled: open,
  })

  // Only offer non-archived, current-version Assessment Form templates — but
  // keep an already-assigned one visible even if it's since been archived or
  // superseded by a newer version, so unassigning still works.
  const assignableForms = formsList.filter((f) => (!f.isArchived && !f.supersededByFormId) || f.id in selectedForms)

  const mutation = useMutation({
    mutationFn: async () =>
      (
        await api.patch(`/api/tenants/me/sections/${section!.sectionId}/forms`, {
          forms: Object.entries(selectedForms).map(([formId, fillPolicy]) => ({ formId: Number(formId), fillPolicy })),
        })
      ).data,
    onSuccess: () => {
      toast.success(t('programDetail.formAssigned'))
      onSaved()
      onOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err, t('programDetail.formAssignFailed'))),
  })

  function toggleForm(formId: number) {
    setSelectedForms((current) => {
      if (formId in current) {
        const { [formId]: _removed, ...rest } = current
        return rest
      }
      return { ...current, [formId]: 'first_claim' }
    })
  }

  function setFillPolicy(formId: number, fillPolicy: 'primary_founder' | 'first_claim') {
    setSelectedForms((current) => ({ ...current, [formId]: fillPolicy }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('programDetail.assignFormTitle', { title: section?.title })}</DialogTitle>
          <DialogDescription>{t('programDetail.assignFormDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>{t('programDetail.formLabel')}</Label>
          {assignableForms.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('programDetail.noFormsAvailable')}</p>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {assignableForms.map((form) => {
                const fillPolicy = selectedForms[form.id]
                const checked = fillPolicy !== undefined
                return (
                  <div
                    key={form.id}
                    className={cn('rounded-lg border p-2.5 space-y-2', checked ? 'border-primary bg-primary/5' : 'hover:bg-muted/50')}
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleForm(form.id)}
                        className="h-4 w-4 shrink-0 accent-primary"
                      />
                      <span className="text-sm">
                        {form.title}
                        {form.version > 1 && <span className="text-muted-foreground ml-1">v{form.version}</span>}
                      </span>
                    </label>
                    {checked && (
                      <div className="pl-6 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {(['first_claim', 'primary_founder'] as const).map((option) => (
                          <label
                            key={option}
                            className={cn(
                              'flex items-center gap-1.5 rounded-md border p-1.5 cursor-pointer text-xs',
                              fillPolicy === option ? 'border-primary bg-primary/10' : 'hover:bg-muted/50',
                            )}
                          >
                            <input
                              type="radio"
                              name={`fill-policy-${form.id}`}
                              checked={fillPolicy === option}
                              onChange={() => setFillPolicy(form.id, option)}
                              className="h-3.5 w-3.5 shrink-0 accent-primary"
                            />
                            {t(`programDetail.fillPolicy.${option}`)}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
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
