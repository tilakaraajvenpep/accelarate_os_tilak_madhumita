import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, FileText, Search, ChevronUp, ChevronDown } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/ui/loader'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useConfirm } from '@/components/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import type { FormEntry, FormStatus, SimpleFormQuestion, SimpleQuestionType } from '@/types/form'

const QUESTION_TYPES: { value: SimpleQuestionType; labelKey: string }[] = [
  { value: 'short_text', labelKey: 'questionTypes.short_text' },
  { value: 'long_text', labelKey: 'questionTypes.long_text' },
  { value: 'number', labelKey: 'questionTypes.number' },
  { value: 'single_choice', labelKey: 'questionTypes.single_choice' },
  { value: 'multiple_choice', labelKey: 'questionTypes.multiple_choice' },
  { value: 'date', labelKey: 'questionTypes.date' },
]

function newQuestionId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `q-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error
    ?? (err instanceof Error ? err.message : fallback)
}

export default function FormsPage() {
  const { t } = useTranslation('forms')
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingForm, setEditingForm] = useState<FormEntry | null>(null)
  const [viewingForm, setViewingForm] = useState<FormEntry | null>(null)

  const { data: formsList = [], isLoading } = useQuery({
    queryKey: ['forms'],
    queryFn: async () => (await api.get<FormEntry[]>('/api/tenants/me/forms')).data,
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/api/tenants/me/forms/${id}`)).data,
    onSuccess: () => {
      toast.success(t('toast.deleted'))
      queryClient.invalidateQueries({ queryKey: ['forms'] })
    },
    onError: (err) => toast.error(apiError(err, t('toast.deleteFailed'))),
  })

  async function handleDelete(form: FormEntry) {
    const ok = await confirm({
      title: t('deleteDialog.title'),
      description: t('deleteDialog.confirm', { name: form.name }),
      confirmLabel: t('common:delete'),
      variant: 'destructive',
    })
    if (ok) {
      deleteMutation.mutate(form.id)
    }
  }

  function openCreate() {
    setEditingForm(null)
    setDialogOpen(true)
  }

  function openEdit(form: FormEntry) {
    setEditingForm(form)
    setDialogOpen(true)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('page.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('page.subtitle')}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> {t('page.createButton')}
        </Button>
      </div>

      <div className="surface-card">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">{t('table.cardTitle')}</h2>
        </div>
        <div className="px-6 py-4 border-b grid grid-cols-2 text-xs font-medium text-muted-foreground">
          <span>{t('table.name')}</span>
          <span>{t('common:status')}</span>
        </div>
        {isLoading ? (
          <div className="py-10 flex justify-center">
            <Loader />
          </div>
        ) : (
          <>
            {formsList.length === 0 ? (
              <div className="text-center py-10">
                <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">{t('table.empty')}</p>
              </div>
            ) : (
              <div className="divide-y">
                {formsList.map((form) => (
                  <div key={form.id} className="flex items-center gap-3 px-6 py-3 hover:bg-muted/50 transition-colors">
                    <div className="grid grid-cols-2 flex-1 min-w-0 items-center gap-3">
                      <span className="font-medium truncate">{form.name}</span>
                      <Badge variant={form.status === 'active' ? 'default' : 'secondary'} className="w-fit">
                        {t(`status.${form.status}`)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon-sm" title={t('common:view')} onClick={() => setViewingForm(form)}>
                        <Search className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" title={t('common:edit')} onClick={() => openEdit(form)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" title={t('common:delete')} onClick={() => handleDelete(form)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <FormFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        form={editingForm}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['forms'] })}
      />

      <FormViewDialog form={viewingForm} onOpenChange={(open) => !open && setViewingForm(null)} />


    </div>
  )
}

function FormViewDialog({
  form,
  onOpenChange,
}: {
  form: FormEntry | null
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation('forms')

  return (
    <Dialog open={!!form} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('viewDialog.title', { name: form?.name })}</DialogTitle>
        </DialogHeader>
        {!form || form.schema.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">{t('viewDialog.noQuestions')}</p>
        ) : (
          <div className="space-y-3">
            {form.schema.map((question, index) => (
              <div key={question.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium">
                    {index + 1}. {question.title || '—'}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="outline">{t(`questionTypes.${question.type}`)}</Badge>
                    {question.required && <Badge variant="secondary">{t('viewDialog.requiredBadge')}</Badge>}
                  </div>
                </div>
                {question.helpText && <p className="text-xs text-muted-foreground">{question.helpText}</p>}
                {(question.type === 'single_choice' || question.type === 'multiple_choice') && (question.options ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(question.options ?? []).map((opt, i) => (
                      <Badge key={i} variant="secondary" className="font-normal">
                        {opt}
                      </Badge>
                    ))}
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

function FormFormDialog({
  open,
  onOpenChange,
  form,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: FormEntry | null
  onSaved: () => void
}) {
  const { t } = useTranslation('forms')
  const confirm = useConfirm()
  const [name, setName] = useState('')
  const [status, setStatus] = useState<FormStatus>('active')
  const [schema, setSchema] = useState<SimpleFormQuestion[]>([])
  const [lastFormId, setLastFormId] = useState<number | null | undefined>(undefined)

  const formKey = form?.id ?? null
  if (open && formKey !== lastFormId) {
    setLastFormId(formKey)
    setName(form?.name ?? '')
    setStatus(form?.status ?? 'active')
    setSchema(form?.schema ?? [])
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const body = { name, status, schema }
      if (form) return (await api.patch(`/api/tenants/me/forms/${form.id}`, body)).data
      return (await api.post('/api/tenants/me/forms', body)).data
    },
    onSuccess: () => {
      toast.success(form ? t('toast.updated') : t('toast.created'))
      onSaved()
      onOpenChange(false)
    },
    onError: (err) => toast.error(apiError(err, t('toast.saveFailed'))),
  })

  const formValid = name.trim().length > 0 && schema.every((q) => q.title.trim().length > 0)

  function addQuestion() {
    setSchema((current) => [...current, { id: newQuestionId(), title: '', type: 'short_text' }])
  }

  function updateQuestion(id: string, patch: Partial<SimpleFormQuestion>) {
    setSchema((current) => current.map((q) => (q.id === id ? { ...q, ...patch } : q)))
  }

  async function removeQuestion(id: string, title: string) {
    const ok = await confirm({
      title: t('dialog.deleteQuestionTitle') || 'Delete Question',
      description: t('dialog.deleteQuestionConfirm', { title: title || 'this question' }) || `Are you sure you want to delete this question?`,
      confirmLabel: t('common:delete') || 'Delete',
      variant: 'destructive',
    })
    if (ok) {
      setSchema((current) => current.filter((q) => q.id !== id))
    }
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    setSchema((current) => {
      const target = index + direction
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{form ? t('dialog.editTitle') : t('dialog.createTitle')}</DialogTitle>
          <DialogDescription>{t('dialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label required>{t('dialog.nameLabel')}</Label>
            <Input value={name} placeholder={t('dialog.namePlaceholder')} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label>{t('common:status')}</Label>
            <Select value={status} onValueChange={(v) => setStatus((v as FormStatus) ?? 'active')}>
              <SelectTrigger className="w-full">
                <SelectValue>{(value: string | null) => t(`status.${value ?? 'active'}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t('status.active')}</SelectItem>
                <SelectItem value="inactive">{t('status.inactive')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('dialog.questionsLabel')}</Label>
              <Button variant="outline" size="sm" onClick={addQuestion}>
                <Plus className="h-3.5 w-3.5" /> {t('dialog.addQuestionButton')}
              </Button>
            </div>

            {schema.length === 0 && <p className="text-xs text-muted-foreground">{t('dialog.noQuestions')}</p>}

            {schema.map((question, index) => (
              <div key={question.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={question.title}
                    placeholder={t('dialog.questionTitlePlaceholder')}
                    onChange={(e) => updateQuestion(question.id, { title: e.target.value })}
                    className="flex-1"
                  />
                  <Select value={question.type} onValueChange={(v) => updateQuestion(question.id, { type: v as SimpleQuestionType })}>
                    <SelectTrigger className="w-40 shrink-0">
                      <SelectValue>{() => t(QUESTION_TYPES.find((qt) => qt.value === question.type)?.labelKey ?? '')}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {QUESTION_TYPES.map((qt) => (
                        <SelectItem key={qt.value} value={qt.value}>
                          {t(qt.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => moveQuestion(index, -1)}>
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" disabled={index === schema.length - 1} onClick={() => moveQuestion(index, 1)}>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => removeQuestion(question.id, question.title)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>

                {(question.type === 'single_choice' || question.type === 'multiple_choice') && (
                  <Textarea
                    value={(question.options ?? []).join('\n')}
                    placeholder={t('dialog.optionsPlaceholder')}
                    onChange={(e) => updateQuestion(question.id, { options: e.target.value.split('\n') })}
                    rows={3}
                  />
                )}

                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!question.required}
                    onChange={(e) => updateQuestion(question.id, { required: e.target.checked })}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  {t('dialog.requiredLabel')}
                </label>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:cancel')}
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!formValid || mutation.isPending}>
            {form ? t('common:saveChanges') : t('dialog.createButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
