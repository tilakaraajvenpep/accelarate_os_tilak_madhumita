import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, CalendarDays } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { Loader } from '@/components/ui/loader'
import { useViewAsCompany } from '@/context/view-as-context'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useConfirm } from '@/components/confirm-dialog'
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
import type { Cohort } from '@/types/cohort'
import type { CohortTask } from '@/types/cohort-task'
import type { CompanyEntry } from '@/types/company'

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error
    ?? (err instanceof Error ? err.message : fallback)
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function todayKey() {
  return toDateKey(new Date())
}

function eachDateKeyInRange(startKey: string, endKey: string): string[] {
  const [sy, sm, sd] = startKey.split('-').map(Number)
  const [ey, em, ed] = endKey.split('-').map(Number)
  const cursor = new Date(sy, sm - 1, sd)
  const end = new Date(ey, em - 1, ed)
  const keys: string[] = []
  while (cursor <= end) {
    keys.push(toDateKey(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return keys
}

function buildMonthMatrix(year: number, month: number): Date[][] {
  const firstOfMonth = new Date(year, month, 1)
  const gridStart = new Date(year, month, 1 - firstOfMonth.getDay())
  const weeks: Date[][] = []
  const cursor = new Date(gridStart)
  for (let w = 0; w < 6; w++) {
    const week: Date[] = []
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}

export default function CalendarPage() {
  const { user } = useAuth()
  const { t } = useTranslation('calendar')
  const queryClient = useQueryClient()

  const [selectedCohortId, setSelectedCohortId] = useState<number | null>(null)
  const [viewDate, setViewDate] = useState(() => new Date())
  const [selectedDateKey, setSelectedDateKey] = useState(() => todayKey())
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<CohortTask | null>(null)
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null)
  const [viewingTasksDateKey, setViewingTasksDateKey] = useState<string | null>(null)
  const confirm = useConfirm()

  const viewAs = useViewAsCompany()
  // A "View as founder" preview always behaves like the founder branch below, regardless of the admin's real role.
  const isFounder = !!viewAs || user?.role === 'founder'

  const { data: founderCalendar, isLoading: founderCalendarLoading } = useQuery({
    queryKey: ['founder-calendar', viewAs?.companyId],
    queryFn: async () =>
      (
        await api.get<{ cohortId: number | null; cohortName: string | null; tasks: CohortTask[] }>(
          viewAs ? `/api/tenants/me/companies/${viewAs.companyId}/view-as/calendar` : '/api/tenants/me/founder/calendar',
        )
      ).data,
    enabled: isFounder,
  })

  const { data: cohortsList = [] } = useQuery({
    queryKey: ['cohorts'],
    queryFn: async () => (await api.get<Cohort[]>('/api/tenants/me/cohorts')).data,
    enabled: !viewAs && user?.role === 'admin',
  })

  if (!isFounder && cohortsList.length > 0 && selectedCohortId === null) {
    setSelectedCohortId(cohortsList[0].id)
  }

  const { data: adminTasks = [], isLoading: adminTasksLoading } = useQuery({
    queryKey: ['cohort-tasks', selectedCohortId],
    queryFn: async () => (await api.get<CohortTask[]>(`/api/tenants/me/cohorts/${selectedCohortId}/tasks`)).data,
    enabled: !isFounder && selectedCohortId !== null,
  })

  const tasks = isFounder ? (founderCalendar?.tasks ?? []) : adminTasks
  const tasksLoading = isFounder ? founderCalendarLoading : adminTasksLoading

  const { data: companyEntries = [] } = useQuery({
    queryKey: ['company-entries', { cohortId: selectedCohortId }],
    queryFn: async () => (await api.get<CompanyEntry[]>(`/api/tenants/me/companies?cohortId=${selectedCohortId}`)).data,
    enabled: !isFounder && selectedCohortId !== null && taskDialogOpen,
  })

  const activeCompanies = useMemo(
    () =>
      companyEntries
        .filter((c) => c.status === 'active')
        .map((c) => ({ id: Number(c.id.replace('company-', '')), name: c.name ?? c.founderName ?? '—' })),
    [companyEntries],
  )

  const tasksByDate = useMemo(() => {
    const map = new Map<string, CohortTask[]>()
    for (const task of tasks) {
      // A program assigned with no calendar-enabled pillars/sections gets a
      // dateless placeholder task (see assignProgramToCohort) — nothing to
      // place on the grid for it.
      if (!task.startDate) continue
      const keys = eachDateKeyInRange(task.startDate, task.endDate ?? task.startDate)
      for (const key of keys) {
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(task)
      }
    }
    return map
  }, [tasks])

  const deleteMutation = useMutation({
    mutationFn: async (task: CohortTask) =>
      (await api.delete(`/api/tenants/me/cohorts/${selectedCohortId}/tasks/${task.id}`)).data,
    onSuccess: () => {
      toast.success(t('toast.deleted'))
      queryClient.invalidateQueries({ queryKey: ['cohort-tasks', selectedCohortId] })
    },
    onError: (err) => toast.error(apiError(err, t('toast.deleteFailed'))),
  })

  async function handleDeleteTask(task: CohortTask) {
    const ok = await confirm({
      title: t('deleteDialog.title'),
      description: t('deleteDialog.confirm', { title: task.title }),
      confirmLabel: t('common:delete'),
      variant: 'destructive',
    })
    if (ok) {
      deleteMutation.mutate(task)
    }
  }

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const monthTasks = useMemo(() => {
    const monthStart = toDateKey(new Date(year, month, 1))
    const monthEnd = toDateKey(new Date(year, month + 1, 0))
    return tasks
      .filter((task): task is CohortTask & { startDate: string } => !!task.startDate)
      .filter((task) => (task.endDate ?? task.startDate) >= monthStart && task.startDate <= monthEnd)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
  }, [tasks, year, month])

  if (user?.role !== 'admin' && user?.role !== 'founder') {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        {t('notAvailable')}
      </div>
    )
  }

  const weeks = buildMonthMatrix(year, month)
  const monthLabel = viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const weekdayLabels = [0, 1, 2, 3, 4, 5, 6].map((i) =>
    new Date(2024, 0, 7 + i).toLocaleDateString(undefined, { weekday: 'short' }),
  )

  function goToMonth(delta: number) {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1))
  }

  function goToToday() {
    const now = new Date()
    setViewDate(now)
    const key = todayKey()
    setSelectedDateKey(key)
    const dayTasks = tasksByDate.get(key) ?? []
    if (dayTasks.length > 0) {
      setExpandedTaskId(dayTasks[0].id)
    } else {
      setExpandedTaskId(null)
    }
  }

  function jumpToDate(key: string) {
    if (!key) return
    const [y, m] = key.split('-').map(Number)
    setViewDate(new Date(y, m - 1, 1))
    setSelectedDateKey(key)
    const dayTasks = tasksByDate.get(key) ?? []
    if (dayTasks.length > 0) {
      setExpandedTaskId(dayTasks[0].id)
    } else {
      setExpandedTaskId(null)
    }
  }

  function openCreateTask() {
    setEditingTask(null)
    setTaskDialogOpen(true)
  }

  function openEditTask(task: CohortTask) {
    setEditingTask(task)
    setTaskDialogOpen(true)
  }

  const selectedDateTasks = tasksByDate.get(selectedDateKey) ?? []
  const selectedDateLabel = new Date(`${selectedDateKey}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isFounder && founderCalendar?.cohortName
              ? `${founderCalendar.cohortName} Calendar`
              : t('page.title')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t('page.subtitle')}</p>
        </div>
        {!isFounder && cohortsList.length > 0 && (
          <Select value={selectedCohortId ? String(selectedCohortId) : ''} onValueChange={(v) => v && setSelectedCohortId(Number(v))}>
            <SelectTrigger className="w-56">
              <SelectValue>{(value: string | null) => cohortsList.find((c) => String(c.id) === value)?.name ?? t('page.selectCohort')}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {cohortsList.map((cohort) => (
                <SelectItem key={cohort.id} value={String(cohort.id)}>
                  {cohort.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!isFounder && cohortsList.length === 0 ? (
        <div className="surface-card p-10 text-center">
          <CalendarDays className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{t('page.noCohorts')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 surface-card p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                {monthLabel}
              </h2>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={selectedDateKey}
                  onChange={(e) => jumpToDate(e.target.value)}
                  className="h-9 w-[150px]"
                  aria-label={t('page.jumpToDate')}
                />
                <Button variant="outline" size="sm" onClick={goToToday}>
                  {t('page.today')}
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => goToMonth(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => goToMonth(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5 mb-1.5">
              {weekdayLabels.map((label) => (
                <div key={label} className="text-center text-xs font-medium text-muted-foreground py-1">
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {weeks.flat().map((day) => {
                const key = toDateKey(day)
                const inCurrentMonth = day.getMonth() === month
                const isToday = key === todayKey()
                const isSelected = key === selectedDateKey
                const dayTasks = tasksByDate.get(key) ?? []
                const hasTask = dayTasks.length > 0
                const hasStart = dayTasks.some((task) => task.startDate === key)

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelectedDateKey(key)
                      if (dayTasks.length > 0) {
                        setExpandedTaskId(dayTasks[0].id)
                        setViewingTasksDateKey(key)
                      } else {
                        setExpandedTaskId(null)
                      }
                    }}
                    title={dayTasks.map((task) => task.title).join(', ')}
                    className={cn(
                      'flex items-center justify-center rounded-lg border p-1.5 min-h-[52px] text-center transition-colors',
                      !inCurrentMonth && 'opacity-35',
                      isSelected ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted/50',
                    )}
                  >
                    <span
                      className={cn(
                        'h-8 w-8 flex items-center justify-center rounded-full text-sm font-medium transition-colors',
                        hasTask && hasStart && 'bg-primary text-primary-foreground',
                        hasTask && !hasStart && 'border-2 border-primary text-primary',
                        isToday && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                      )}
                    >
                      {day.getDate()}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="surface-card p-4 space-y-3 h-fit lg:sticky lg:top-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b">
              <h3 className="font-semibold text-sm truncate">{selectedDateLabel}</h3>
              {!isFounder && (
                <Button size="sm" onClick={openCreateTask}>
                  <Plus className="h-3.5 w-3.5" /> {t('page.addTaskButton')}
                </Button>
              )}
            </div>

            <div className="space-y-1">
              {monthTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground py-1">{t('page.noTasksThisMonth')}</p>
              ) : (
                monthTasks.map((task) => (
                  <div key={task.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDateKey(task.startDate)
                        setExpandedTaskId((current) => (current === task.id ? null : task.id))
                      }}
                      className="w-full flex items-center gap-2.5 rounded-lg px-1.5 py-1 text-left text-sm hover:bg-muted/50 transition-colors"
                    >
                      <span className="h-5 w-5 shrink-0 flex items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                        {new Date(`${task.startDate}T00:00:00`).getDate()}
                      </span>
                      <span className="truncate">{task.title}</span>
                      {task.endDate && task.endDate !== task.startDate && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          ({new Date(`${task.startDate}T00:00:00`).getDate()}–{new Date(`${task.endDate}T00:00:00`).getDate()})
                        </span>
                      )}
                    </button>
                    {expandedTaskId === task.id && (
                      <p className="pl-8 pr-1.5 pb-1.5 text-xs text-muted-foreground">
                        {task.description || t('page.noDescription')}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="border-t pt-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t('page.tasksForDate', { date: selectedDateLabel })}</h4>

              {tasksLoading ? (
                <div className="py-4 flex justify-center">
                  <Loader />
                </div>
              ) : selectedDateTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">{t('page.noTasksForDate')}</p>
              ) : (
                <div className="space-y-2">
                  {selectedDateTasks.map((task) => (
                  <div key={task.id} className="rounded-lg border bg-background p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{task.title}</p>
                      {!isFounder && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Button variant="ghost" size="icon-sm" title={t('common:edit')} onClick={() => openEditTask(task)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" title={t('common:delete')} onClick={() => handleDeleteTask(task)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                    {task.description && <p className="text-xs text-muted-foreground">{task.description}</p>}
                    <div className="flex items-center gap-2 flex-wrap">
                      {task.programName && (
                        <Badge variant="default" className="text-[10px]">
                          {t('page.programBadge', { name: task.programName })}
                        </Badge>
                      )}
                      {task.companyName && (
                        <Badge variant="secondary" className="text-[10px]">
                          {task.companyName}
                        </Badge>
                      )}
                      <span className="text-[11px] text-muted-foreground">{t('page.assignedBy', { name: task.createdByName ?? '—' })}</span>
                    </div>
                  </div>
                ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedCohortId !== null && (
        <TaskFormDialog
          open={taskDialogOpen}
          onOpenChange={setTaskDialogOpen}
          task={editingTask}
          cohortId={selectedCohortId}
          defaultDateKey={selectedDateKey}
          companies={activeCompanies}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['cohort-tasks', selectedCohortId] })}
        />
      )}



      <Dialog open={!!viewingTasksDateKey} onOpenChange={(open) => !open && setViewingTasksDateKey(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {viewingTasksDateKey ? new Date(`${viewingTasksDateKey}T00:00:00`).toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              }) : ''}
            </DialogTitle>
            <DialogDescription>
              {t('page.dialogDescriptionList')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {viewingTasksDateKey && (tasksByDate.get(viewingTasksDateKey) ?? []).map((task) => (
              <div key={task.id} className="rounded-lg border p-3.5 space-y-2 bg-muted/30">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-sm">{task.title}</p>
                </div>
                {task.description ? (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{task.description}</p>
                ) : (
                  <p className="text-xs text-muted-foreground italic">{t('page.noDescription')}</p>
                )}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  {task.programName && (
                    <Badge variant="default" className="text-[10px]">
                      {t('page.programBadge', { name: task.programName })}
                    </Badge>
                  )}
                  {task.companyName && (
                    <Badge variant="secondary" className="text-[10px]">
                      {task.companyName}
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground">{t('page.assignedBy', { name: task.createdByName ?? '—' })}</span>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setViewingTasksDateKey(null)}>{t('common:close') || 'Close'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TaskFormDialog({
  open,
  onOpenChange,
  task,
  cohortId,
  defaultDateKey,
  companies,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: CohortTask | null
  cohortId: number
  defaultDateKey: string
  companies: { id: number; name: string }[]
  onSaved: () => void
}) {
  const { t } = useTranslation('calendar')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState(defaultDateKey)
  const [endDate, setEndDate] = useState('')
  const [companyId, setCompanyId] = useState<number | null>(null)
  const [lastResetKey, setLastResetKey] = useState<string | undefined>(undefined)

  const resetKey = task ? `task-${task.id}` : `new-${defaultDateKey}`
  if (open && resetKey !== lastResetKey) {
    setLastResetKey(resetKey)
    setTitle(task?.title ?? '')
    setDescription(task?.description ?? '')
    setStartDate(task?.startDate ?? defaultDateKey)
    setEndDate(task?.endDate ?? '')
    setCompanyId(task?.companyId ?? null)
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const body = { title, description: description || null, startDate, endDate: endDate || null, companyId }
      if (task) return (await api.patch(`/api/tenants/me/cohorts/${cohortId}/tasks/${task.id}`, body)).data
      return (await api.post(`/api/tenants/me/cohorts/${cohortId}/tasks`, body)).data
    },
    onSuccess: () => {
      toast.success(task ? t('toast.updated') : t('toast.created'))
      onSaved()
      onOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err, t('toast.saveFailed'))),
  })

  const dateOrderValid = !endDate || endDate >= startDate
  const formValid = title.trim().length > 0 && startDate.length > 0 && dateOrderValid

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{task ? t('dialog.editTitle') : t('dialog.createTitle')}</DialogTitle>
          <DialogDescription>{t('dialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label required>{t('dialog.titleLabel')}</Label>
            <Input value={title} placeholder={t('dialog.titlePlaceholder')} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label required>{t('dialog.startDateLabel')}</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('dialog.endDateLabel')}</Label>
              <Input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          {!dateOrderValid && <p className="text-xs text-destructive -mt-2">{t('dialog.dateOrderError')}</p>}

          <div className="space-y-1.5">
            <Label>{t('dialog.descriptionLabel')}</Label>
            <Textarea
              value={description}
              placeholder={t('dialog.descriptionPlaceholder')}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('dialog.companyLabel')}</Label>
            <Select
              value={companyId === null ? 'none' : String(companyId)}
              onValueChange={(v) => setCompanyId(!v || v === 'none' ? null : Number(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string | null) =>
                    value && value !== 'none' ? (companies.find((c) => String(c.id) === value)?.name ?? t('dialog.companyNone')) : t('dialog.companyNone')
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('dialog.companyNone')}</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:cancel')}
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!formValid || mutation.isPending}>
            {task ? t('common:saveChanges') : t('dialog.createButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
