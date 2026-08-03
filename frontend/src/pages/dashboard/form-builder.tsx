import { useState, useMemo, useEffect, Fragment } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  LayoutDashboard,
  GripVertical,
  Copy,
  Settings,
  Pencil,
  Check,
  ChevronsUpDown,
  Eye,
  FileText,
  History,
  Layers,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useConfirm } from '@/components/confirm-dialog'
import { ListToolbar, ListPagination } from '@/components/list-toolbar'
import { useListControls } from '@/hooks/use-list-controls'
import { Loader } from '@/components/ui/loader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { NumericInput } from '@/components/numeric-input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RichTextEditor } from '@/components/rich-text-editor'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { buttonVariants } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { cn } from '@/lib/utils'
import type {
  FormQuestion,
  FormQuestionOption,
  EditableTableColumn,
  EditableTableRow,
  FormTemplateDetail,
  FormTemplateSummary,
  FormMapping,
  QuestionType,
  PillarDefinition,
  FormImpactPreview,
  FormTemplateResponsesResult,
} from '@/types/forms'
import type { Cohort } from '@/types/cohort'
import type { Program, Pillar, PillarDetail } from '@/types/program'

const CATEGORIES: { value: string; label: string; disabled?: boolean }[] = [
  { value: 'pillar_diagnostic', label: 'Pillar Diagnostic' },
  { value: 'governance_review', label: 'Governance Review' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'question_and_answer', label: 'Question and Answer' },
]

const MAPPING_TYPES: { value: string; label: string; disabled?: boolean }[] = [
  { value: 'pillar_diagnostic', label: 'Pillar Diagnostic / Regular' },
  { value: 'governance_review', label: 'Governance Review' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'mentor_onboarding', label: 'Mentor Onboarding (replaces the specialization step)' },
  { value: 'tenant_admin_onboarding', label: 'Tenant Admin Onboarding (replaces the /get-started org-details step)' },
]

// These types aren't pillar/section-scoped — the picker skips the Pillar Context/Section fields for them.
const ONBOARDING_MAPPING_TYPES = new Set(['mentor_onboarding', 'tenant_admin_onboarding'])
// tenant_admin_onboarding is tenant-wide only; mentor_onboarding likewise has no per-cohort override today.
const COHORT_SCOPED_ONBOARDING_TYPES = new Set<string>([])
const ONBOARDING_CONTEXT_ID = 'default'

const SECTION_BASE = ['A', 'B', 'C', 'D', 'E', 'Feedback']

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'short_text', label: 'Short Text' },
  { value: 'long_text', label: 'Long Text' },
  { value: 'number', label: 'Number' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'single_choice', label: 'Multiple Choice (Single)' },
  { value: 'multiple_choice', label: 'Checkboxes (Multiple)' },
  { value: 'date', label: 'Date' },
  { value: 'editable_table', label: 'Editable Table' },
]

const CHOICE_TYPES: QuestionType[] = ['dropdown', 'single_choice', 'multiple_choice']

const COLUMN_TYPES: { value: EditableTableColumn['type']; label: string }[] = [
  { value: 'text', label: 'Short Text' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Dropdown' },
  { value: 'radio', label: 'Radio Buttons' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'date', label: 'Date' },
  { value: 'label', label: 'Label (Read-only)' },
]

const CHOICE_COLUMN_TYPES: EditableTableColumn['type'][] = ['select', 'radio', 'checkbox']

function apiError(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
    (err instanceof Error ? err.message : fallback)
  )
}

function blankQuestion(): FormQuestion {
  return { id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, title: '', type: 'short_text', required: false, options: null, helpText: null }
}

function blankOption(): FormQuestionOption {
  return { label: '', score: 0 }
}

export default function FormBuilderPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const isEditing = !!id
  const [mode, setMode] = useState<'list' | 'builder'>(isEditing ? 'builder' : 'list')

  // Re-clicking "Forms" in the sidebar while already here pushes a fresh navigation
  // (new location.key) without changing the pathname, so this is the only signal
  // that tells us to drop out of local "create new template" mode back to the list.
  useEffect(() => {
    if (!isEditing) setMode('list')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key])

  if (mode === 'list' && !isEditing) {
    return <FormLibraryTabs onCreate={() => setMode('builder')} />
  }
  return <FormBuilderForm onCancel={() => (isEditing ? navigate(-1) : setMode('list'))} />
}

function FormLibraryTabs({ onCreate }: { onCreate: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [duplicateTarget, setDuplicateTarget] = useState<FormTemplateSummary | null>(null)
  const [responsesTarget, setResponsesTarget] = useState<FormTemplateSummary | null>(null)
  const [viewingTemplate, setViewingTemplate] = useState<FormTemplateSummary | null>(null)
  const [expandedFamilies, setExpandedFamilies] = useState<Set<number>>(new Set())
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false)
  const [pillarFilter, setPillarFilter] = useState('all')
  const [draggingMappingId, setDraggingMappingId] = useState<number | null>(null)
  const [dragOverMappingId, setDragOverMappingId] = useState<number | null>(null)

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['form-templates'],
    queryFn: async () => (await api.get<FormTemplateSummary[]>('/api/tenants/me/form-templates')).data,
  })

  // Group every version of "the same form" together so the library shows one
  // row per form family (current version) with older versions tucked behind
  // a "History" toggle, instead of every fork appearing as an unrelated row.
  const families = useMemo(() => {
    const byRoot = new Map<number, FormTemplateSummary[]>()
    for (const t of templates) {
      const root = t.rootTemplateId ?? t.id
      if (!byRoot.has(root)) byRoot.set(root, [])
      byRoot.get(root)!.push(t)
    }
    for (const list of byRoot.values()) list.sort((a, b) => b.version - a.version)
    return [...byRoot.values()].sort(
      (a, b) => new Date(b[0].createdAt).getTime() - new Date(a[0].createdAt).getTime(),
    )
  }, [templates])

  const templateControls = useListControls(families, {
    searchFields: (family) => {
      const current = family.find((t) => !t.supersededByFormId) ?? family[0]
      return [current.title, current.category]
    },
    statusValue: (family) => {
      const current = family.find((t) => !t.supersededByFormId) ?? family[0]
      return !current.isArchived
    },
  })

  const { data: mappings = [], isLoading: mappingsLoading } = useQuery({
    queryKey: ['form-mappings'],
    queryFn: async () => (await api.get<FormMapping[]>('/api/tenants/me/form-mappings')).data,
  })

  const archiveMutation = useMutation({
    mutationFn: async (t: FormTemplateSummary) =>
      (await api.patch<FormTemplateSummary>(`/api/tenants/me/form-templates/${t.id}/status`, { isArchived: !t.isArchived })).data,
    onSuccess: (updated) => {
      toast.success(updated.isArchived ? 'Template archived' : 'Template activated')
      queryClient.invalidateQueries({ queryKey: ['form-templates'] })
    },
    onError: (err) => toast.error(apiError(err, 'Failed to update status')),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/api/tenants/me/form-templates/${id}`)).data,
    onSuccess: () => {
      toast.success('Template deleted')
      queryClient.invalidateQueries({ queryKey: ['form-templates'] })
    },
    onError: (err) => toast.error(apiError(err, 'Failed to delete template')),
  })

  async function handleDeleteTemplate(template: FormTemplateSummary) {
    const ok = await confirm({
      title: 'Delete template?',
      description: `Permanently delete "${template.title}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'destructive',
    })
    if (!ok) return
    deleteMutation.mutate(template.id)
  }

  const duplicateMutation = useMutation({
    mutationFn: async (id: number) => (await api.post(`/api/tenants/me/form-templates/${id}/duplicate`)).data,
    onSuccess: () => {
      toast.success('Template duplicated')
      queryClient.invalidateQueries({ queryKey: ['form-templates'] })
      setDuplicateTarget(null)
    },
    onError: (err) => toast.error(apiError(err, 'Failed to duplicate template')),
  })

  const deleteMappingMutation = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/api/tenants/me/form-mappings/${id}`)).data,
    onSuccess: () => {
      toast.success('Mapping removed')
      queryClient.invalidateQueries({ queryKey: ['form-mappings'] })
    },
    onError: (err) => toast.error(apiError(err, 'Failed to remove mapping')),
  })

  async function handleDeleteMapping(id: number) {
    const ok = await confirm({
      title: 'Remove mapping?',
      description: 'Remove this mapping?',
      confirmLabel: 'Remove',
      variant: 'destructive',
    })
    if (!ok) return
    deleteMappingMutation.mutate(id)
  }

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: number[]) =>
      (await api.put('/api/tenants/me/form-mappings/reorder', { orderedIds })).data,
    onSuccess: () => {
      toast.success('Order updated')
      queryClient.invalidateQueries({ queryKey: ['form-mappings'] })
    },
    onError: (err) => toast.error(apiError(err, 'Failed to reorder')),
  })

  function handleDropOnMapping(groupItems: FormMapping[], targetId: number) {
    if (draggingMappingId === null || draggingMappingId === targetId) return
    const fromIndex = groupItems.findIndex((m) => m.id === draggingMappingId)
    const toIndex = groupItems.findIndex((m) => m.id === targetId)
    if (fromIndex === -1 || toIndex === -1) return
    const next = [...groupItems]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    reorderMutation.mutate(next.map((m) => m.id))
  }

  const templateTitleById = new Map(templates.map((t) => [t.id, t.title]))
  const grouped = new Map<string, FormMapping[]>()
  for (const m of mappings) {
    const key = `${m.contextId}::${m.sectionId}::${m.type}`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(m)
  }
  for (const items of grouped.values()) items.sort((a, b) => a.sortOrder - b.sortOrder)

  const pillarOptions = useMemo(
    () =>
      Array.from(new Set(mappings.filter((m) => m.contextId !== ONBOARDING_CONTEXT_ID).map((m) => m.contextId))).sort(
        (a, b) => Number(a) - Number(b) || a.localeCompare(b),
      ),
    [mappings],
  )
  const groupKeys = [...grouped.keys()]
    .filter((key) => pillarFilter === 'all' || key.startsWith(`${pillarFilter}::`))
    .sort()

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Forms</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage form templates and assign them to pillars/sections.</p>
      </div>

      <Tabs defaultValue="library">
        <TabsList>
          <TabsTrigger value="library">Template Library</TabsTrigger>
          <TabsTrigger value="mappings">Mappings</TabsTrigger>
          <TabsTrigger value="pillars">Pillars</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">All Templates</h2>
            <Button onClick={onCreate}>
              <Plus className="h-4 w-4" /> Create Template
            </Button>
          </div>

          <div className="surface-card">
            <div className="px-6 py-4 border-b flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold">Templates</h2>
            </div>
            <div className="px-6 py-3 border-b">
              <ListToolbar controls={templateControls} searchPlaceholder="Search…" activeLabel="Active" inactiveLabel="Archived" />
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Date created</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10">
                        <Loader />
                      </TableCell>
                    </TableRow>
                  ) : (
                    templateControls.paged.map((family) => {
                      const current = family.find((t) => !t.supersededByFormId) ?? family[0]
                      const history = family.filter((t) => t.id !== current.id)
                      const expanded = expandedFamilies.has(current.id)
                      return (
                        <Fragment key={current.id}>
                          <TableRow className={current.isArchived ? 'opacity-60' : ''}>
                            <TableCell className="font-medium">
                              {current.title}
                              {current.version > 1 && (
                                <Badge variant="outline" className="ml-2">
                                  v{current.version}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>{CATEGORIES.find((c) => c.value === current.category)?.label ?? current.category}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(current.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-3">
                                <Badge variant={current.isArchived ? 'secondary' : 'default'}>
                                  {current.isArchived ? 'Archived' : 'Active'}
                                </Badge>
                                <Switch
                                  checked={!current.isArchived}
                                  onCheckedChange={() => archiveMutation.mutate(current)}
                                />
                              </div>
                            </TableCell>
                            <TableCell className="pr-4">
                              <div className="flex items-center justify-end gap-1">
                                {history.length > 0 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      setExpandedFamilies((prev) => {
                                        const next = new Set(prev)
                                        if (next.has(current.id)) next.delete(current.id)
                                        else next.add(current.id)
                                        return next
                                      })
                                    }
                                  >
                                    <History className="h-3.5 w-3.5" /> History ({history.length})
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon-sm" title="View" onClick={() => setViewingTemplate(current)}>
                                  <FileText className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon-sm" title="View responses" onClick={() => setResponsesTarget(current)}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon-sm" title="Branch out" onClick={() => setDuplicateTarget(current)}>
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  title="Edit"
                                  onClick={() => navigate(`/setup/assessment-forms/${current.id}`)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon-sm" title="Delete" onClick={() => handleDeleteTemplate(current)}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {expanded &&
                            history.map((old) => (
                              <TableRow key={old.id} className="opacity-60 bg-muted/30">
                                <TableCell className="font-medium pl-8">
                                  {old.title}
                                  <Badge variant="secondary" className="ml-2">
                                    v{old.version} · Superseded
                                  </Badge>
                                </TableCell>
                                <TableCell>{CATEGORIES.find((c) => c.value === old.category)?.label ?? old.category}</TableCell>
                                <TableCell className="text-muted-foreground">{new Date(old.createdAt).toLocaleDateString()}</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="secondary">Superseded</Badge>
                                </TableCell>
                                <TableCell className="pr-4">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button variant="ghost" size="icon-sm" title="View" onClick={() => setViewingTemplate(old)}>
                                      <FileText className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon-sm" title="View responses" onClick={() => setResponsesTarget(old)}>
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon-sm" title="Delete" disabled>
                                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                        </Fragment>
                      )
                    })
                  )}
                  {!isLoading && templateControls.paged.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10">
                        <LayoutDashboard className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">No templates yet — create one to get started.</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="px-6 py-3 border-t">
              <ListPagination controls={templateControls} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="mappings" className="space-y-4 mt-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Contextual Mappings</h2>
            <div className="flex items-center gap-2">
              <Select value={pillarFilter} onValueChange={(v) => v && setPillarFilter(v)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue>{(v: string) => (v === 'all' ? 'All Pillars' : `Pillar ${v}`)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pillars</SelectItem>
                  {pillarOptions.map((p) => (
                    <SelectItem key={p} value={p}>
                      Pillar {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => setMappingDialogOpen(true)}>
                <Plus className="h-4 w-4" /> Assign Template
              </Button>
            </div>
          </div>

          {mappingsLoading ? (
            <div className="surface-card p-10 flex justify-center">
              <Loader />
            </div>
          ) : groupKeys.length === 0 ? (
            <div className="surface-card p-10 text-center">
              <Layers className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No mappings yet — assign a template to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupKeys.map((key) => {
                const items = grouped.get(key)!
                const [contextId, sectionId, type] = key.split('::')
                const groupLabel = ONBOARDING_MAPPING_TYPES.has(type)
                  ? MAPPING_TYPES.find((t) => t.value === type)?.label ?? type
                  : `Pillar ${contextId}${sectionId ? ` — Section ${sectionId}` : ''}`
                return (
                  <div key={key} className="surface-card overflow-hidden">
                    <div className="px-4 py-3 border-b bg-muted/40">
                      <h3 className="font-semibold text-sm">
                        {groupLabel}{' '}
                        {!ONBOARDING_MAPPING_TYPES.has(type) && (
                          <span className="text-muted-foreground font-normal ml-1">
                            ({type === 'feedback' ? 'Feedback' : type})
                          </span>
                        )}
                      </h3>
                    </div>
                    <div className="p-2 space-y-1">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          onDragOver={(e) => {
                            if (draggingMappingId === null) return
                            e.preventDefault()
                            setDragOverMappingId(item.id)
                          }}
                          onDragLeave={() => setDragOverMappingId((cur) => (cur === item.id ? null : cur))}
                          onDrop={(e) => {
                            e.preventDefault()
                            handleDropOnMapping(items, item.id)
                            setDraggingMappingId(null)
                            setDragOverMappingId(null)
                          }}
                          className={cn(
                            'flex items-center justify-between p-2.5 rounded-lg border transition-opacity',
                            draggingMappingId === item.id && 'opacity-40',
                            dragOverMappingId === item.id && draggingMappingId !== item.id && 'ring-2 ring-primary',
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              draggable
                              onDragStart={(e) => {
                                setDraggingMappingId(item.id)
                                e.dataTransfer.effectAllowed = 'move'
                                e.dataTransfer.setData('text/plain', String(item.id))
                              }}
                              onDragEnd={() => {
                                setDraggingMappingId(null)
                                setDragOverMappingId(null)
                              }}
                              className="cursor-grab active:cursor-grabbing"
                            >
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <span className="text-sm font-medium">
                              {templateTitleById.get(item.templateId) ?? `Template #${item.templateId}`}
                            </span>
                          </div>
                          <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteMapping(item.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pillars" className="space-y-4 mt-4">
          <PillarDefinitionsPanel />
        </TabsContent>
      </Tabs>

      <DuplicateDialog
        template={duplicateTarget}
        onOpenChange={(open) => !open && setDuplicateTarget(null)}
        onConfirm={() => duplicateTarget && duplicateMutation.mutate(duplicateTarget.id)}
        pending={duplicateMutation.isPending}
      />

      <AssignMappingDialog
        open={mappingDialogOpen}
        onOpenChange={setMappingDialogOpen}
        templates={templates.filter((t) => !t.isArchived && !t.supersededByFormId)}
        mappings={mappings}
        onAssigned={() => queryClient.invalidateQueries({ queryKey: ['form-mappings'] })}
      />

      <FormResponsesDialog template={responsesTarget} onOpenChange={(open) => !open && setResponsesTarget(null)} />

      <TemplateViewDialog template={viewingTemplate} onOpenChange={(open) => !open && setViewingTemplate(null)} />
    </div>
  )
}

function PillarDefinitionsPanel() {
  const queryClient = useQueryClient()
  const [drafts, setDrafts] = useState<Record<number, string>>({})

  const { data: definitions = [], isLoading } = useQuery({
    queryKey: ['pillar-definitions'],
    queryFn: async () => (await api.get<PillarDefinition[]>('/api/tenants/me/pillar-definitions')).data,
  })

  const upsertMutation = useMutation({
    mutationFn: async ({ pillarNumber, title }: { pillarNumber: number; title: string }) =>
      (await api.put('/api/tenants/me/pillar-definitions', { pillarNumber, title })).data,
    onSuccess: () => {
      toast.success('Pillar title saved')
      queryClient.invalidateQueries({ queryKey: ['pillar-definitions'] })
    },
    onError: (err) => toast.error(apiError(err, 'Failed to save pillar title')),
  })

  return (
    <div className="surface-card">
      <div className="px-6 py-4 border-b flex items-center gap-2">
        <Layers className="h-4 w-4 text-muted-foreground" />
        <div>
          <h2 className="font-semibold">Pillar Titles</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Pillars are detected automatically from your Pillar Diagnostic mappings — set a display title for each here.
          </p>
        </div>
      </div>
      <div className="p-4 space-y-3">
        {!isLoading && definitions.length === 0 && (
          <div className="text-center py-10">
            <Layers className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No pillars yet — create a Pillar Diagnostic mapping to detect one.
            </p>
          </div>
        )}
        {definitions.map((def) => {
          const draft = drafts[def.pillarNumber] ?? def.title ?? ''
          return (
            <div key={def.pillarNumber} className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground w-20 shrink-0">Pillar {def.pillarNumber}</span>
              <Input
                value={draft}
                placeholder={`Pillar ${def.pillarNumber}`}
                onChange={(e) => setDrafts((d) => ({ ...d, [def.pillarNumber]: e.target.value }))}
                onBlur={() => {
                  if (draft.trim() && draft !== (def.title ?? '')) {
                    upsertMutation.mutate({ pillarNumber: def.pillarNumber, title: draft.trim() })
                  }
                }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DuplicateDialog({
  template,
  onOpenChange,
  onConfirm,
  pending,
}: {
  template: FormTemplateSummary | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  pending: boolean
}) {
  return (
    <Dialog open={!!template} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Branch out "{template?.title}"</DialogTitle>
          <DialogDescription>Creates a copy of this template that you can edit independently.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            Branch out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FormResponsesDialog({
  template,
  onOpenChange,
}: {
  template: FormTemplateSummary | null
  onOpenChange: (open: boolean) => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['form-template-responses', template?.id],
    queryFn: async () => (await api.get<FormTemplateResponsesResult>(`/api/tenants/me/form-templates/${template!.id}/responses`)).data,
    enabled: !!template,
  })

  return (
    <Dialog open={!!template} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Responses — {template?.title} (v{template?.version})
          </DialogTitle>
          <DialogDescription>Submitted answers from founders, across every version of this form.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading responses…</p>
        ) : !data || data.responses.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No responses submitted yet.</p>
        ) : (
          <div className="space-y-3">
            {data.responses.map((r, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between text-sm gap-2">
                  <span className="font-medium">
                    {r.companyName} — {r.founderName}
                  </span>
                  <span className="text-muted-foreground text-xs shrink-0">
                    {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : 'Draft — not yet submitted'}
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  {r.answers.map((a) => (
                    <div key={a.questionId} className="flex gap-2">
                      <span className="text-muted-foreground shrink-0">{a.questionTitle}:</span>
                      <span className="break-words">
                        {Array.isArray(a.value) ? a.value.join(', ') : typeof a.value === 'object' && a.value !== null ? JSON.stringify(a.value) : String(a.value ?? '—')}
                      </span>
                    </div>
                  ))}
                  {r.consentAccepted !== null && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground shrink-0">Consent:</span>
                      <span>{r.consentAccepted ? 'Accepted' : 'Not accepted'}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function TemplateViewDialog({
  template,
  onOpenChange,
}: {
  template: FormTemplateSummary | null
  onOpenChange: (open: boolean) => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['form-template-detail', template?.id],
    queryFn: async () => (await api.get<FormTemplateDetail>(`/api/tenants/me/form-templates/${template!.id}`)).data,
    enabled: !!template,
  })

  return (
    <Dialog open={!!template} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template?.title} {template && template.version > 1 && `(v${template.version})`}
          </DialogTitle>
          <DialogDescription>{template?.description || 'Read-only view of this form’s questions.'}</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
        ) : !data || data.schema.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">This form has no questions yet.</p>
        ) : (
          <div className="space-y-3">
            {data.schema.map((question, index) => (
              <div key={question.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium">
                    {index + 1}. {question.title || '(untitled question)'}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="outline">{QUESTION_TYPES.find((qt) => qt.value === question.type)?.label ?? question.type}</Badge>
                    {question.required && <Badge variant="secondary">Required</Badge>}
                  </div>
                </div>
                {question.helpText && <p className="text-xs text-muted-foreground">{question.helpText}</p>}
                {CHOICE_TYPES.includes(question.type) && question.options && question.options.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {question.options.map((opt, i) => (
                      <Badge key={i} variant="secondary" className="font-normal">
                        {opt.label} {opt.score ? `(${opt.score} pts)` : ''}
                      </Badge>
                    ))}
                  </div>
                )}
                {question.type === 'editable_table' && (
                  <div className="space-y-1">
                    <div className="flex flex-wrap gap-1.5">
                      {(question.columns ?? []).map((col) => (
                        <Badge key={col.id} variant="secondary" className="font-normal">
                          {col.label} · {COLUMN_TYPES.find((ct) => ct.value === col.type)?.label ?? col.type}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {(question.defaultRows ?? []).length} default row(s)
                      {question.allowAddRows ? ' · founders can add rows' : ''}
                      {question.summaryRow?.enabled ? ' · has a summary row' : ''}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function AssignMappingDialog({
  open,
  onOpenChange,
  templates,
  mappings,
  onAssigned,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  templates: FormTemplateSummary[]
  mappings: FormMapping[]
  onAssigned: () => void
}) {
  const queryClient = useQueryClient()
  const [templateId, setTemplateId] = useState<string>('')
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)
  const [cohortId, setCohortId] = useState<string>('all')
  const [newCohortName, setNewCohortName] = useState('')
  const [newCohortStartDate, setNewCohortStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [newCohortEndDate, setNewCohortEndDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 6)
    return d.toISOString().slice(0, 10)
  })
  const [contextId, setContextId] = useState('')
  const [newPillarNumber, setNewPillarNumber] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [newSectionId, setNewSectionId] = useState('')
  const [type, setType] = useState('pillar_diagnostic')

  // Pillar Diagnostic no longer uses the freeform pillar-number/section-letter
  // fields above — it assigns straight into the real Program > Pillar >
  // Section catalog (the same one Setup > Programs uses), via a cascading
  // picker backed by these three ids.
  const [catalogProgramId, setCatalogProgramId] = useState('')
  const [catalogPillarId, setCatalogPillarId] = useState('')
  const [catalogSectionId, setCatalogSectionId] = useState('')

  const isOnboardingType = ONBOARDING_MAPPING_TYPES.has(type)
  const isPillarDiagnostic = type === 'pillar_diagnostic'
  const effectiveContextId = isOnboardingType ? ONBOARDING_CONTEXT_ID : contextId

  const { data: cohorts = [] } = useQuery({
    queryKey: ['cohorts'],
    queryFn: async () => (await api.get<Cohort[]>('/api/tenants/me/cohorts')).data,
    enabled: open,
  })

  const { data: pillarDefs = [] } = useQuery({
    queryKey: ['pillar-definitions'],
    queryFn: async () => (await api.get<PillarDefinition[]>('/api/tenants/me/pillar-definitions')).data,
    enabled: open,
  })

  const { data: catalogPrograms = [] } = useQuery({
    queryKey: ['programs'],
    queryFn: async () => (await api.get<Program[]>('/api/tenants/me/programs')).data,
    enabled: open && isPillarDiagnostic,
  })

  const { data: catalogPillars = [] } = useQuery({
    queryKey: ['program-pillars-all', catalogProgramId],
    queryFn: async () => (await api.get<Pillar[]>(`/api/tenants/me/pillars?programId=${catalogProgramId}`)).data,
    enabled: open && isPillarDiagnostic && !!catalogProgramId,
  })

  const { data: catalogPillarDetail } = useQuery({
    queryKey: ['pillar', catalogPillarId],
    queryFn: async () => (await api.get<PillarDetail>(`/api/tenants/me/pillars/${catalogPillarId}`)).data,
    enabled: open && isPillarDiagnostic && !!catalogPillarId,
  })

  // Every pillar number that already has at least one mapping, even if it
  // hasn't been given a title yet — union'd with pillarDefs so nothing's lost.
  const pillarNumbers = useMemo(() => {
    const fromMappings = mappings.map((m) => m.contextId).filter((c) => /^\d+$/.test(c))
    const fromDefs = pillarDefs.map((d) => String(d.pillarNumber))
    return Array.from(new Set([...fromDefs, ...fromMappings])).sort((a, b) => Number(a) - Number(b))
  }, [mappings, pillarDefs])

  const pillarTitleByNumber = new Map(pillarDefs.map((d) => [String(d.pillarNumber), d.title]))

  const sectionOptions = useMemo(() => {
    const used = mappings.filter((m) => m.contextId === contextId).map((m) => m.sectionId).filter(Boolean)
    return Array.from(new Set([...SECTION_BASE, ...used]))
  }, [mappings, contextId])

  const createCohortMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post<Cohort>('/api/tenants/me/cohorts', {
          name: newCohortName,
          startDate: newCohortStartDate,
          endDate: newCohortEndDate,
        })
      ).data,
    onSuccess: (cohort) => {
      toast.success('Cohort created')
      queryClient.invalidateQueries({ queryKey: ['cohorts'] })
      setCohortId(String(cohort.id))
      setNewCohortName('')
    },
    onError: (err) => toast.error(apiError(err, 'Failed to create cohort')),
  })

  const assignMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post('/api/tenants/me/form-mappings', {
          templateId: Number(templateId),
          cohortId: (isOnboardingType && !COHORT_SCOPED_ONBOARDING_TYPES.has(type)) || cohortId === 'all' ? null : Number(cohortId),
          type,
          contextId: effectiveContextId,
          sectionId: isOnboardingType ? undefined : sectionId || undefined,
        })
      ).data,
    onSuccess: () => {
      toast.success('Template assigned')
      onAssigned()
      onOpenChange(false)
      setTemplateId('')
      setContextId('')
      setSectionId('')
    },
    onError: (err) => toast.error(apiError(err, 'Failed to assign template')),
  })

  // Pillar Diagnostic assigns straight into the real catalog's sectionForms
  // (the same mechanism Setup > Programs' own "Assign forms" dialog uses) —
  // that call replaces a section's whole form list, so the existing ones
  // have to be read back and carried along rather than overwritten.
  const assignToCatalogSectionMutation = useMutation({
    mutationFn: async () => {
      const targetSection = catalogPillarDetail?.sections.find((s) => String(s.sectionId) === catalogSectionId)
      if (!targetSection) throw new Error('Section not found')
      const forms = [
        ...targetSection.forms.filter((f) => f.id !== Number(templateId)).map((f) => ({ formId: f.id, fillPolicy: f.fillPolicy })),
        { formId: Number(templateId), fillPolicy: 'first_claim' as const },
      ]
      return (await api.patch(`/api/tenants/me/sections/${catalogSectionId}/forms`, { forms })).data
    },
    onSuccess: () => {
      toast.success('Template assigned')
      onAssigned()
      queryClient.invalidateQueries({ queryKey: ['pillars'] })
      queryClient.invalidateQueries({ queryKey: ['pillar'] })
      onOpenChange(false)
      setTemplateId('')
      setCatalogProgramId('')
      setCatalogPillarId('')
      setCatalogSectionId('')
    },
    onError: (err) => toast.error(apiError(err, 'Failed to assign template')),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Template to Context</DialogTitle>
          <DialogDescription>Pick a template and where it should appear.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label required>Template</Label>
            <Popover open={templatePickerOpen} onOpenChange={setTemplatePickerOpen}>
              <PopoverTrigger className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-between font-normal')}>
                {templateId ? templates.find((t) => String(t.id) === templateId)?.title : 'Search and select a template...'}
                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
              </PopoverTrigger>
              <PopoverContent className="w-[420px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search templates..." />
                  <CommandList>
                    <CommandEmpty>No template found.</CommandEmpty>
                    <CommandGroup>
                      {templates.map((t) => (
                        <CommandItem
                          key={t.id}
                          value={t.title}
                          onSelect={() => {
                            setTemplateId(String(t.id))
                            setTemplatePickerOpen(false)
                          }}
                        >
                          <Check className={cn('h-4 w-4', templateId === String(t.id) ? 'opacity-100' : 'opacity-0')} />
                          {t.title}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {isPillarDiagnostic ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label required>Program</Label>
                <Select
                  value={catalogProgramId}
                  onValueChange={(v) => {
                    if (!v) return
                    setCatalogProgramId(v)
                    setCatalogPillarId('')
                    setCatalogSectionId('')
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a program">
                      {(v: string) => catalogPrograms.find((p) => String(p.id) === v)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {catalogPrograms.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label required>Pillar</Label>
                  <Select
                    value={catalogPillarId}
                    disabled={!catalogProgramId}
                    onValueChange={(v) => {
                      if (!v) return
                      setCatalogPillarId(v)
                      setCatalogSectionId('')
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a pillar">
                        {(v: string) => catalogPillars.find((p) => String(p.id) === v)?.title}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {catalogPillars.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label required>Section</Label>
                  <Select value={catalogSectionId} disabled={!catalogPillarId} onValueChange={(v) => v && setCatalogSectionId(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a section">
                        {(v: string) => catalogPillarDetail?.sections.find((s) => String(s.sectionId) === v)?.title}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(catalogPillarDetail?.sections ?? []).map((s) => (
                        <SelectItem key={s.sectionId} value={String(s.sectionId)}>
                          {s.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Assigns this template into the section's form list — the same catalog Setup &gt; Programs uses, so it shows up there too.
              </p>
            </div>
          ) : (
            <>
              {(!isOnboardingType || COHORT_SCOPED_ONBOARDING_TYPES.has(type)) && (
                <div className="space-y-1.5">
                  <Label>Cohort{isOnboardingType ? ' (optional — overrides the tenant-wide form for this cohort only)' : ''}</Label>
                  <div className="flex gap-2">
                    <Select value={cohortId} onValueChange={(v) => v && setCohortId(v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue>{(v: string) => (v === 'all' ? 'All cohorts' : (cohorts.find((c) => String(c.id) === v)?.name ?? v))}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All cohorts</SelectItem>
                        {cohorts.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {!isOnboardingType && (
                    <div className="flex gap-2">
                      <Input
                        placeholder="New cohort name"
                        value={newCohortName}
                        onChange={(e) => setNewCohortName(e.target.value)}
                        className="flex-1"
                      />
                      <Input type="date" value={newCohortStartDate} onChange={(e) => setNewCohortStartDate(e.target.value)} className="w-36" />
                      <Input type="date" value={newCohortEndDate} onChange={(e) => setNewCohortEndDate(e.target.value)} className="w-36" />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!newCohortName.trim() || createCohortMutation.isPending}
                        onClick={() => createCohortMutation.mutate()}
                      >
                        Add
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {!isOnboardingType && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label required>Pillar Context</Label>
                    <Select value={contextId} onValueChange={(v) => v && setContextId(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select pillar">
                          {(v: string) => `Pillar ${v}${pillarTitleByNumber.get(v) ? ` — ${pillarTitleByNumber.get(v)}` : ''}`}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {pillarNumbers.map((p) => (
                          <SelectItem key={p} value={p}>
                            Pillar {p}
                            {pillarTitleByNumber.get(p) ? ` — ${pillarTitleByNumber.get(p)}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <NumericInput
                        placeholder="New pillar number"
                        value={newPillarNumber}
                        onChange={setNewPillarNumber}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!newPillarNumber.trim()}
                        onClick={() => {
                          setContextId(newPillarNumber.trim())
                          setNewPillarNumber('')
                        }}
                      >
                        Use
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label required>Section Scope</Label>
                    <Select value={sectionId} onValueChange={(v) => v && setSectionId(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select section">{(v: string) => (v === 'Feedback' ? 'Feedback' : `Section ${v}`)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {sectionOptions.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s === 'Feedback' ? 'Feedback' : `Section ${s}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Input
                        placeholder="New section (e.g. F)"
                        value={newSectionId}
                        onChange={(e) => setNewSectionId(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!newSectionId.trim()}
                        onClick={() => {
                          setSectionId(newSectionId.trim())
                          setNewSectionId('')
                        }}
                      >
                        Use
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="space-y-1.5">
            <Label>Mapping type</Label>
            <Select value={type} onValueChange={(v) => v && setType(v)}>
              <SelectTrigger className="w-full">
                <SelectValue>{(v: string) => MAPPING_TYPES.find((t) => t.value === v)?.label ?? v}</SelectValue>
              </SelectTrigger>
              <SelectContent className="w-[420px] min-w-[420px] max-w-[90vw]">
                {MAPPING_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value} disabled={t.disabled} className="py-2">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => (isPillarDiagnostic ? assignToCatalogSectionMutation.mutate() : assignMutation.mutate())}
            disabled={
              !templateId ||
              (isPillarDiagnostic
                ? !catalogSectionId || assignToCatalogSectionMutation.isPending
                : !effectiveContextId || assignMutation.isPending)
            }
          >
            Save mapping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FormBuilderForm({ onCancel }: { onCancel: () => void }) {
  const { t } = useTranslation('programs')
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEditing = !!id

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('pillar_diagnostic')
  const [isMultipleEntry, setIsMultipleEntry] = useState(false)
  const [requireConsent, setRequireConsent] = useState(false)
  const [consentTermsText, setConsentTermsText] = useState('')
  const [questions, setQuestions] = useState<FormQuestion[]>([])

  const { isLoading } = useQuery({
    queryKey: ['form-template', id],
    queryFn: async () => {
      const { data } = await api.get<FormTemplateDetail>(`/api/tenants/me/form-templates/${id}`)
      setTitle(data.title)
      setDescription(data.description ?? '')
      setCategory(data.category)
      setIsMultipleEntry(data.isMultipleEntry)
      setRequireConsent(data.requireConsent)
      setConsentTermsText(data.consentTermsText ?? '')
      setQuestions(data.schema)
      return data
    },
    enabled: isEditing,
  })

  const [forkImpact, setForkImpact] = useState<FormImpactPreview | null>(null)
  const [forkDialogOpen, setForkDialogOpen] = useState(false)

  function buildBody() {
    return {
      title,
      description: description || null,
      category,
      isMultipleEntry,
      requireConsent,
      consentTermsText: requireConsent ? consentTermsText || null : null,
      schema: questions.filter((q) => q.title.trim().length > 0),
    }
  }

  const saveMutation = useMutation({
    mutationFn: async (confirmNewVersion: boolean) => {
      const body = buildBody()
      if (isEditing) return (await api.patch(`/api/tenants/me/form-templates/${id}`, { ...body, confirmNewVersion })).data
      return (await api.post('/api/tenants/me/form-templates', body)).data
    },
    onSuccess: (data: { forkedVersion?: boolean; version?: number }) => {
      toast.success(data?.forkedVersion ? `Version ${data.version} created — the previous version and its responses are preserved` : isEditing ? 'Template updated' : 'Template created')
      setForkDialogOpen(false)
      navigate('/setup/assessment-forms')
    },
    onError: (err) => toast.error(apiError(err, 'Failed to save template')),
  })

  const previewMutation = useMutation({
    mutationFn: async () => (await api.post<FormImpactPreview>(`/api/tenants/me/form-templates/${id}/impact-preview`, { schema: buildBody().schema })).data,
    onSuccess: (impact) => {
      if (impact.willFork) {
        setForkImpact(impact)
        setForkDialogOpen(true)
      } else {
        saveMutation.mutate(false)
      }
    },
    onError: (err) => toast.error(apiError(err, 'Failed to check existing responses')),
  })

  function handleSaveClick() {
    if (!isEditing) {
      saveMutation.mutate(false)
      return
    }
    previewMutation.mutate()
  }

  function updateQuestion(index: number, patch: Partial<FormQuestion>) {
    setQuestions((qs) => qs.map((q, i) => (i === index ? { ...q, ...patch } : q)))
  }

  function addQuestion() {
    setQuestions((qs) => [...qs, blankQuestion()])
  }

  function removeQuestion(index: number) {
    setQuestions((qs) => qs.filter((_, i) => i !== index))
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    setQuestions((qs) => {
      const target = index + direction
      if (target < 0 || target >= qs.length) return qs
      const next = [...qs]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  function reorderQuestion(from: number, to: number) {
    setQuestions((qs) => {
      if (from === to || from < 0 || to < 0 || from >= qs.length || to >= qs.length) return qs
      const next = [...qs]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const formValid = title.trim().length > 0 && questions.some((q) => q.title.trim().length > 0)

  if (isEditing && isLoading) {
    return <div className="flex h-full items-center justify-center text-muted-foreground text-sm">{t('common:loading')}</div>
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{isEditing ? 'Edit template' : 'New template'}</h1>
          <p className="text-muted-foreground text-sm mt-1">Define the form's details, category, and questions.</p>
        </div>
      </div>

      <div className="surface-card p-6 space-y-5">
        <div className="space-y-1.5">
          <Label required>Form Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </div>

        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="flex items-end gap-4">
          <div className="flex-1 space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => v && setCategory(v)}>
              <SelectTrigger className="w-full">
                <SelectValue>{(v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value} disabled={c.disabled}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-start gap-2 pb-1.5 max-w-[240px]">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded-full border-input accent-primary"
              checked={isMultipleEntry}
              onChange={(e) => setIsMultipleEntry(e.target.checked)}
            />
            <span>
              <span className="text-sm font-medium block">Allow Multiple Entries</span>
              <span className="text-xs text-muted-foreground">If checked, founders can submit this form multiple times.</span>
            </span>
          </label>
        </div>

        <div className="space-y-3 pt-1">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded-full border-input accent-primary"
              checked={requireConsent}
              onChange={(e) => setRequireConsent(e.target.checked)}
            />
            <span>
              <span className="text-sm font-medium block">Require Consent</span>
              <span className="text-xs text-muted-foreground">
                If checked, founders must read the Terms and Conditions below and tick a consent box before the form becomes usable.
              </span>
            </span>
          </label>

          {requireConsent && (
            <div className="pl-6 space-y-1.5">
              <Label>Terms &amp; Conditions Text</Label>
              <RichTextEditor
                value={consentTermsText}
                onChange={setConsentTermsText}
                placeholder="Enter the terms and conditions the founder must read and agree to before filling out this form..."
              />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {questions.length > 0 && (
          <div className="surface-card p-6 space-y-3">
            <h2 className="font-semibold">Questions</h2>
            <div className="space-y-3">
              {questions.map((question, index) => (
                <div
                  key={question.id}
                  onDragOver={(e) => {
                    if (draggingIndex === null) return
                    e.preventDefault()
                    setDragOverIndex(index)
                  }}
                  onDragLeave={() => setDragOverIndex((cur) => (cur === index ? null : cur))}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (draggingIndex !== null) reorderQuestion(draggingIndex, index)
                    setDraggingIndex(null)
                    setDragOverIndex(null)
                  }}
                  className={`rounded-lg border p-4 space-y-3 transition-opacity ${
                    draggingIndex === index ? 'opacity-40' : ''
                  } ${dragOverIndex === index && draggingIndex !== index ? 'ring-2 ring-primary' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      draggable
                      onDragStart={(e) => {
                        setDraggingIndex(index)
                        e.dataTransfer.effectAllowed = 'move'
                        // Firefox requires setData to be called for the drag to actually start.
                        e.dataTransfer.setData('text/plain', String(index))
                      }}
                      onDragEnd={() => {
                        setDraggingIndex(null)
                        setDragOverIndex(null)
                      }}
                      className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground cursor-grab active:cursor-grabbing"
                    >
                      <GripVertical className="h-4 w-4" />
                      <span>Q{index + 1}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded-full border-input accent-primary"
                          checked={question.required ?? false}
                          onChange={(e) => updateQuestion(index, { required: e.target.checked })}
                        />
                        Required
                      </label>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => moveQuestion(index, -1)}>
                          <ChevronUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={index === questions.length - 1}
                          onClick={() => moveQuestion(index, 1)}
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => removeQuestion(index)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 space-y-1.5">
                      <Label>Question Text</Label>
                      <Input
                        value={question.title}
                        placeholder="e.g. What did you accomplish this week?"
                        onChange={(e) => updateQuestion(index, { title: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Type</Label>
                      <Select value={question.type} onValueChange={(v) => v && updateQuestion(index, { type: v as QuestionType })}>
                        <SelectTrigger className="w-full">
                          <SelectValue>{(v: string) => QUESTION_TYPES.find((qt) => qt.value === v)?.label ?? v}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {QUESTION_TYPES.map((qt) => (
                            <SelectItem key={qt.value} value={qt.value}>
                              {qt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Helper Text / Description</Label>
                    <Input
                      value={question.helpText ?? ''}
                      placeholder="Optional description shown below the question"
                      onChange={(e) => updateQuestion(index, { helpText: e.target.value || null })}
                    />
                  </div>

                  {CHOICE_TYPES.includes(question.type) && (
                    <OptionsEditor
                      options={question.options ?? []}
                      onChange={(options) => updateQuestion(index, { options })}
                    />
                  )}

                  {question.type === 'editable_table' && (
                    <EditableTableConfig
                      question={question}
                      onChange={(patch) => updateQuestion(index, patch)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={addQuestion}
          className="w-full rounded-xl border-2 border-dashed p-8 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Question
        </button>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          {t('common:cancel')}
        </Button>
        <Button onClick={handleSaveClick} disabled={!formValid || saveMutation.isPending || previewMutation.isPending}>
          {previewMutation.isPending ? 'Checking…' : isEditing ? 'Save changes' : 'Create template'}
        </Button>
      </div>

      <Dialog
        open={forkDialogOpen}
        onOpenChange={(open) => {
          setForkDialogOpen(open)
          if (!open) setForkImpact(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create a new version?</DialogTitle>
            <DialogDescription>
              This form has {forkImpact?.responseCount} response{(forkImpact?.responseCount ?? 0) === 1 ? '' : 's'} across{' '}
              {forkImpact?.companyCount} compan{(forkImpact?.companyCount ?? 0) === 1 ? 'y' : 'ies'}. Saving will create Version{' '}
              {forkImpact?.nextVersion} and email those founders to fill it in again. The current version and its responses stay
              exactly as they are.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForkDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveMutation.mutate(true)} disabled={saveMutation.isPending}>
              Create version {forkImpact?.nextVersion} & save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: FormQuestionOption[]
  onChange: (options: FormQuestionOption[]) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label>Options</Label>
      <div className="space-y-2">
        {options.map((option, optionIndex) => (
          <div key={optionIndex} className="flex items-center gap-2">
            <Input
              value={option.label}
              placeholder="Option label"
              className="flex-1"
              onChange={(e) => {
                const next = [...options]
                next[optionIndex] = { ...option, label: e.target.value }
                onChange(next)
              }}
            />
            <NumericInput
              allowNegative
              value={String(option.score)}
              placeholder="Score"
              className="w-24"
              onChange={(v) => {
                const next = [...options]
                next[optionIndex] = { ...option, score: Number(v) || 0 }
                onChange(next)
              }}
            />
            <Button variant="ghost" size="icon-sm" onClick={() => onChange(options.filter((_, i) => i !== optionIndex))}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...options, blankOption()])}>
        <Plus className="h-3.5 w-3.5" /> Add option
      </Button>
    </div>
  )
}

function EditableTableConfig({
  question,
  onChange,
}: {
  question: FormQuestion
  onChange: (patch: Partial<FormQuestion>) => void
}) {
  const columns = question.columns ?? []
  const rows = question.defaultRows ?? []

  function updateColumn(index: number, patch: Partial<EditableTableColumn>) {
    const next = [...columns]
    next[index] = { ...next[index], ...patch }
    onChange({ columns: next })
  }

  function updateRow(index: number, patch: Partial<EditableTableRow>) {
    const next = [...rows]
    next[index] = { ...next[index], ...patch }
    onChange({ defaultRows: next })
  }

  return (
    <div className="space-y-6 rounded-lg border bg-muted/30 p-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Table columns</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({ columns: [...columns, { id: `col_${Date.now()}`, label: 'New column', type: 'text' }] })
            }
          >
            <Plus className="h-3.5 w-3.5" /> Add column
          </Button>
        </div>

        <div className="space-y-3">
          {columns.map((col, colIdx) => (
            <div key={col.id} className="rounded-lg border bg-card p-3 space-y-2">
              <div className="flex items-start gap-2">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Label</Label>
                    <Input className="h-8 text-xs" value={col.label} onChange={(e) => updateColumn(colIdx, { label: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Type</Label>
                    <Select value={col.type} onValueChange={(v) => v && updateColumn(colIdx, { type: v as EditableTableColumn['type'] })}>
                      <SelectTrigger className="h-8 text-xs w-full">
                        <SelectValue>{(v: string) => COLUMN_TYPES.find((ct) => ct.value === v)?.label ?? v}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {COLUMN_TYPES.map((ct) => (
                          <SelectItem key={ct.value} value={ct.value}>
                            {ct.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="mt-4"
                  onClick={() => onChange({ columns: columns.filter((_, i) => i !== colIdx) })}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>

              {col.type === 'number' && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Format</Label>
                    <Select value={col.format ?? 'number'} onValueChange={(v) => v && updateColumn(colIdx, { format: v as EditableTableColumn['format'] })}>
                      <SelectTrigger className="h-8 text-xs w-full">
                        <SelectValue>{(v: string) => (v === 'currency' ? 'Currency' : 'Plain number')}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="number">Plain number</SelectItem>
                        <SelectItem value="currency">Currency</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {col.format === 'currency' && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Symbol</Label>
                      <Input
                        className="h-8 text-xs"
                        value={col.currencySymbol ?? ''}
                        placeholder="$"
                        onChange={(e) => updateColumn(colIdx, { currencySymbol: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              )}

              {CHOICE_COLUMN_TYPES.includes(col.type) && (
                <div className="pt-2 border-t">
                  <OptionsEditor options={col.options ?? []} onChange={(options) => updateColumn(colIdx, { options })} />
                </div>
              )}
            </div>
          ))}
          {columns.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-4">No columns defined yet.</p>
          )}
        </div>
      </div>

      <div className="space-y-3 pt-4 border-t">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-input accent-primary"
            checked={question.allowAddRows !== false}
            onChange={(e) => onChange({ allowAddRows: e.target.checked })}
          />
          Allow users to add/remove rows
        </label>

        <div className="space-y-1">
          <Label className="text-sm font-semibold">Default rows</Label>
          <p className="text-xs text-muted-foreground">
            Define initial rows founders will see. If "allow add/remove rows" is off, this is their fixed table.
          </p>
        </div>

        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="w-16 px-2 py-2 text-left font-bold text-muted-foreground uppercase border-r">ID</th>
                <th className="w-28 px-2 py-2 text-left font-bold text-muted-foreground uppercase border-r">Kind</th>
                {columns.map((col) => (
                  <th key={col.id} className="px-2 py-2 text-left font-bold text-muted-foreground uppercase">
                    {col.label}
                  </th>
                ))}
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row, rIdx) => (
                <RowEditor
                  key={rIdx}
                  row={row}
                  columns={columns}
                  onChange={(patch) => updateRow(rIdx, patch)}
                  onDelete={() => onChange({ defaultRows: rows.filter((_, i) => i !== rIdx) })}
                />
              ))}
            </tbody>
          </table>
          <div className="p-2 border-t bg-card flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange({ defaultRows: [...rows, { id: '' }] })}
            >
              <Plus className="h-3.5 w-3.5" /> Add row
            </Button>
            {rows.length > 0 && <span className="text-xs text-muted-foreground">{rows.length} rows</span>}
          </div>
        </div>

        <div className="rounded-md border bg-card p-3 text-xs text-muted-foreground space-y-1.5">
          <p className="font-semibold text-foreground">Formula Syntax Guide</p>
          <ul className="space-y-1 list-disc pl-4">
            <li>
              Start with <code className="bg-muted px-1 rounded">=</code> (e.g., <code className="bg-muted px-1 rounded">=10+5</code>)
            </li>
            <li>
              Same Col Reference: <code className="bg-muted px-1 rounded">[A]</code> (Value from row ID "A", same column)
            </li>
            <li>
              Fixed Cell Reference: <code className="bg-muted px-1 rounded">[A:colId]</code> (Specific row and column)
            </li>
            <li>
              Column Sum: <code className="bg-muted px-1 rounded">[SUM:colId]</code> (Total of numeric column)
            </li>
          </ul>
        </div>
      </div>

      <div className="space-y-3 pt-4 border-t">
        <Label className="text-sm font-semibold">Summary row</Label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-input accent-primary"
            checked={question.summaryRow?.enabled ?? false}
            onChange={(e) =>
              onChange({
                summaryRow: {
                  enabled: e.target.checked,
                  label: question.summaryRow?.label ?? 'Total',
                  labelColSpan: question.summaryRow?.labelColSpan ?? 1,
                  valueColId: question.summaryRow?.valueColId ?? '',
                },
              })
            }
          />
          Enable summary row at bottom
        </label>

        {question.summaryRow?.enabled && (
          <div className="grid grid-cols-2 gap-3 pl-4 border-l-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Label</Label>
              <Input
                className="h-8 text-xs"
                value={question.summaryRow?.label ?? ''}
                onChange={(e) => onChange({ summaryRow: { ...question.summaryRow!, label: e.target.value } })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Main column</Label>
              <Select
                value={question.summaryRow?.valueColId ?? ''}
                onValueChange={(v) => v && onChange({ summaryRow: { ...question.summaryRow!, valueColId: v } })}
              >
                <SelectTrigger className="h-8 text-xs w-full">
                  <SelectValue placeholder="Select column">{(v: string) => columns.find((c) => c.id === v)?.label ?? v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {columns.filter((c) => c.type === 'number').map((col) => (
                    <SelectItem key={col.id} value={col.id}>
                      {col.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs text-muted-foreground">Formula (optional)</Label>
              <Input
                className="h-8 text-xs font-mono"
                value={question.summaryRow?.formula ?? ''}
                placeholder="=[A]+[B]-[C]"
                onChange={(e) => onChange({ summaryRow: { ...question.summaryRow!, formula: e.target.value } })}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function RowEditor({
  row,
  columns,
  onChange,
  onDelete,
}: {
  row: EditableTableRow
  columns: EditableTableColumn[]
  onChange: (patch: Partial<EditableTableRow>) => void
  onDelete: () => void
}) {
  const kind = row.isSectionHeader ? 'section' : row.isFormulaRow ? 'formula' : 'normal'

  return (
    <tr className={row.isSectionHeader ? 'bg-muted/40' : row.isFormulaRow ? 'bg-primary/5' : ''}>
      <td className="px-2 py-1.5 border-r">
        <Input
          value={row.id ?? ''}
          onChange={(e) => onChange({ id: e.target.value.toUpperCase() })}
          className="h-7 w-14 text-xs text-center font-mono"
          placeholder="ID"
        />
      </td>
      <td className="px-2 py-1.5 border-r">
        <Select
          value={kind}
          onValueChange={(v) => {
            if (v === 'section') onChange({ isSectionHeader: true, isFormulaRow: false, sectionLevel: row.sectionLevel ?? 1 })
            else if (v === 'formula') onChange({ isFormulaRow: true, isSectionHeader: false })
            else onChange({ isFormulaRow: false, isSectionHeader: false })
          }}
        >
          <SelectTrigger className="h-7 text-xs w-full">
            <SelectValue>{(v: string) => v.charAt(0).toUpperCase() + v.slice(1)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="formula">Formula</SelectItem>
            <SelectItem value="section">Section</SelectItem>
          </SelectContent>
        </Select>
      </td>

      {row.isSectionHeader ? (
        <td colSpan={columns.length || 1} className="px-2 py-1.5">
          <div className="flex items-center gap-2">
            <Select value={String(row.sectionLevel ?? 1)} onValueChange={(v) => v && onChange({ sectionLevel: Number(v) as 1 | 2 | 3 })}>
              <SelectTrigger className="h-7 w-28 text-xs">
                <SelectValue>{(v: string) => `Level ${v}`}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Level 1</SelectItem>
                <SelectItem value="2">Level 2</SelectItem>
                <SelectItem value="3">Level 3</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={row.sectionLabel ?? ''}
              onChange={(e) => onChange({ sectionLabel: e.target.value })}
              className="h-7 text-xs flex-1"
              placeholder="Section title"
            />
            <Popover>
              <PopoverTrigger className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }))}>
                <Settings className="h-3.5 w-3.5" />
              </PopoverTrigger>
              <PopoverContent className="w-72 p-4" side="bottom" align="end">
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm border-b pb-2">Section settings</h4>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Allow adding rows here</Label>
                    <Switch
                      checked={row.sectionAllowAddRows === true}
                      onCheckedChange={(checked) => onChange({ sectionAllowAddRows: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Enable section summary</Label>
                    <Switch
                      checked={row.sectionEnableSummary === true}
                      onCheckedChange={(checked) => onChange({ sectionEnableSummary: checked })}
                    />
                  </div>
                  {row.sectionEnableSummary && (
                    <div className="space-y-2 pt-2 border-t">
                      <Input
                        className="h-7 text-xs"
                        value={row.sectionSummaryLabel ?? ''}
                        placeholder="Summary label"
                        onChange={(e) => onChange({ sectionSummaryLabel: e.target.value })}
                      />
                      <Input
                        className="h-7 text-xs font-mono"
                        value={row.sectionSummaryFormula ?? ''}
                        placeholder="=SUM(col_id)"
                        onChange={(e) => onChange({ sectionSummaryFormula: e.target.value })}
                      />
                      <Input
                        className="h-7 text-xs font-mono"
                        value={row.sectionSummaryVariable ?? ''}
                        placeholder="EXPORT_VAR_NAME"
                        onChange={(e) => onChange({ sectionSummaryVariable: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                      />
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </td>
      ) : (
        columns.map((col) => {
          const value = row[col.id]
          const isFormula = row.isFormulaRow || (typeof value === 'string' && value.startsWith('='))
          const cellConfig = row._cellConfigs?.[col.id]
          const effectiveType = cellConfig?.type === 'select' ? 'select' : col.type

          return (
            <td key={col.id} className="px-2 py-1.5 relative">
              {effectiveType === 'select' ? (
                <Select value={(value as string) ?? ''} onValueChange={(v) => v && onChange({ [col.id]: v })}>
                  <SelectTrigger className="h-7 text-xs w-full">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(cellConfig?.options ?? col.options ?? []).map((opt) => (
                      <SelectItem key={opt.label} value={opt.label}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : col.type === 'checkbox' ? (
                <div className="flex justify-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input accent-primary"
                    checked={!!value}
                    onChange={(e) => onChange({ [col.id]: e.target.checked })}
                  />
                </div>
              ) : (
                <Input
                  type={col.type === 'number' && !isFormula ? 'number' : 'text'}
                  value={(value as string) ?? ''}
                  onChange={(e) => onChange({ [col.id]: e.target.value })}
                  className={cn('h-7 text-xs', isFormula && 'bg-primary/5 text-primary font-medium')}
                  placeholder={col.type === 'label' ? 'Fixed text...' : isFormula ? 'Formula...' : ''}
                />
              )}
            </td>
          )
        })
      )}

      <td className="px-2 py-1.5 text-right">
        <Button variant="ghost" size="icon-sm" onClick={onDelete}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </td>
    </tr>
  )
}
