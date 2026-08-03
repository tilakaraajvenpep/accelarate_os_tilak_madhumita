import { Fragment, useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumericInput } from '@/components/numeric-input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { RichTextView } from '@/components/rich-text-view'
import { cn } from '@/lib/utils'
import type { FormQuestion, EditableTableRow, EditableTableColumn, AnswerScore } from '@/types/forms'

type FormData = Record<string, unknown>

// Ported near-verbatim from the reference export's formula engine. Client-side
// only, by design — no server-side validation of formula strings (matches
// the reference; exports get their own simpler, non-recursive evaluator).
function evaluateFormula(
  formula: string,
  rows: EditableTableRow[],
  colId: string,
  depth = 0,
  contextVars: Record<string, string> = {},
  sourceRow?: EditableTableRow,
): string {
  if (typeof formula !== 'string' || !formula.startsWith('=')) return formula
  if (depth > 10) return '#RECURSION!'

  let expression = formula.substring(1)

  expression = expression.replace(/SUM\(([^)]+)\)/gi, (_match, targetCol) => {
    const trimmedCol = targetCol.trim()
    const sum = rows.reduce((acc, r) => {
      if (r === sourceRow) return acc
      const key = Object.keys(r).find((k) => k.toLowerCase() === trimmedCol.toLowerCase()) || trimmedCol
      const val = r[key]
      const numericVal =
        typeof val === 'string' && val.startsWith('=') ? parseFloat(evaluateFormula(val, rows, key, depth + 1, contextVars, r)) : parseFloat(String(val))
      return acc + (isNaN(numericVal) ? 0 : numericVal)
    }, 0)
    return sum.toString()
  })

  expression = expression.replace(/\[([^\]]+)\]/g, (_match, ref) => {
    if (contextVars && contextVars[ref] !== undefined) return contextVars[ref]

    if (ref.startsWith('SUM:')) {
      const targetCol = ref.split(':')[1]
      const sum = rows.reduce((acc, r) => {
        if (r === sourceRow) return acc
        const val = r[targetCol]
        const numericVal =
          typeof val === 'string' && val.startsWith('=') ? parseFloat(evaluateFormula(val, rows, targetCol, depth + 1, contextVars, r)) : parseFloat(String(val))
        return acc + (isNaN(numericVal) ? 0 : numericVal)
      }, 0)
      return sum.toString()
    }

    const [targetRowId, targetColId] = ref.includes(':') ? ref.split(':') : [ref, colId]
    const targetRow = rows.find((r) => r.id === targetRowId)
    if (!targetRow) return '0'

    const rawVal = targetRow[targetColId]
    const val: number =
      typeof rawVal === 'string' && rawVal.startsWith('=') ? parseFloat(evaluateFormula(rawVal, rows, targetColId, depth + 1)) : parseFloat(String(rawVal))

    if (isNaN(val)) return '0'
    return val.toString()
  })

  try {
    if (/[^a-zA-Z0-9+\-*/().\s%<>=!&|:_]/.test(expression)) {
      return '#INVALID!'
    }
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const result = new Function(`return ${expression.replace(/%/g, '/100')}`)()
    if (typeof result === 'boolean') return result ? 'True' : 'False'
    return typeof result === 'number' && isFinite(result) ? (Math.round(result * 100) / 100).toString() : '0'
  } catch {
    return '#ERROR!'
  }
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true
  if (Array.isArray(value)) return value.length === 0
  return false
}

function translateString(str: string, t: any): string {
  if (!str) return str
  const key = str.toLowerCase().trim()

  // Onboarding fields mapping
  if (key === 'business / brand name') return t('fields.businessBrandName')
  if (key === 'uen (unique entity number)') return t('fields.uen')
  if (key === 'industry') return t('fields.industry')
  if (key === 'company size') return t('fields.companySize')
  if (key === 'full name') return t('fields.fullName')
  if (key === 'role in business') return t('fields.roleInBusiness')
  if (key === 'email address') return t('fields.emailAddress')
  if (key === 'mobile number') return t('fields.mobileNumber')
  if (key === 'whatsapp consent') return t('fields.whatsappConsent')
  if (key === 'email consent') return t('fields.emailConsent')
  if (key === 'platform scope acknowledgement') return t('fields.platformScopeAck')
  if (key === 'participation authority declaration') return t('fields.participationAuthorityAck')

  // Options mapping
  if (key === 'solo') return t('options.solo')
  if (key === '2-10') return t('options.2-10')
  if (key === '11-50') return t('options.11-50')
  if (key === '50+') return t('options.50+')
  if (key === 'technology') return t('options.technology')
  if (key === 'healthcare') return t('options.healthcare')
  if (key === 'finance') return t('options.finance')
  if (key === 'retail / e-commerce') return t('options.retailEcommerce')
  if (key === 'manufacturing') return t('options.manufacturing')
  if (key === 'education') return t('options.education')
  if (key === 'food & beverage') return t('options.foodBeverage')
  if (key === 'real estate') return t('options.realEstate')
  if (key === 'professional services') return t('options.professionalServices')
  if (key === 'other') return t('options.other')
  if (key === 'founder / ceo') return t('options.founderCeo')
  if (key === 'co-founder') return t('options.coFounder')
  if (key === 'cto') return t('options.cto')
  if (key === 'coo') return t('options.coo')
  if (key === 'cfo') return t('options.cfo')

  // Consents & Legal descriptions mapping
  if (key.includes('receiving program updates via whatsapp')) return t('consents.whatsappDesc')
  if (key.includes('receiving program updates via email')) return t('consents.emailDesc')
  if (key.includes('acknowledge that this platform is for tracking and support')) return t('consents.platformScopeDesc')
  if (key.includes('declare that i have the authority to participate')) return t('consents.participationAuthorityDesc')

  return str
}

interface DynamicFormProps {
  schema: FormQuestion[]
  initialData?: FormData
  onSubmit: (data: FormData, status: 'draft' | 'submitted') => Promise<void>
  readOnly?: boolean
  viewMode?: boolean
  hideActions?: boolean
  category?: string
  requireConsent?: boolean
  consentTermsText?: string | null
  // Onboarding forms (company/org/mentor profile details) aren't assessments —
  // scoring a company name against a rubric makes no sense, so callers filling
  // in profile/onboarding data pass this to suppress the AI-analysis badge
  // regardless of whatever category the admin happened to set on the template.
  disableAiScoring?: boolean
}

export function DynamicForm({
  schema,
  initialData,
  onSubmit,
  readOnly,
  viewMode,
  hideActions,
  category,
  requireConsent,
  consentTermsText,
  disableAiScoring,
}: DynamicFormProps) {
  const { t } = useTranslation('dynamicForm')
  const [formData, setFormData] = useState<FormData>(initialData ?? {})
  const [aiScores, setAiScores] = useState<Record<string, AnswerScore>>(
    (initialData?._aiScores as Record<string, AnswerScore>) ?? {},
  )
  const [analyzing, setAnalyzing] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const [consentAccepted, setConsentAccepted] = useState(initialData?._consentAccepted === true)
  const [consentChecked, setConsentChecked] = useState(false)
  const [consentGateOpen, setConsentGateOpen] = useState(false)

  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) setFormData(initialData)
  }, [initialData])

  const skipAiScoring = category === 'feedback' || !!disableAiScoring

  async function analyzeAnswer(id: string, question: string, answer: string) {
    setAnalyzing((s) => ({ ...s, [id]: true }))
    try {
      const { data } = await api.post<AnswerScore>('/api/tenants/me/ai-scoring/analyze', { question, answer })
      setAiScores((s) => ({ ...s, [id]: data }))
    } catch {
      // Best-effort only — scoring failure never blocks the form.
    } finally {
      setAnalyzing((s) => ({ ...s, [id]: false }))
    }
  }

  function handleChange(id: string, value: unknown) {
    setFormData((prev) => ({ ...prev, [id]: value }))

    if (skipAiScoring || readOnly || viewMode) return
    const question = schema.find((q) => q.id === id)
    if (!question || (question.type !== 'short_text' && question.type !== 'long_text')) return

    if (debounceRef.current[id]) clearTimeout(debounceRef.current[id])
    if (typeof value !== 'string' || value.length <= 5) {
      setAiScores((s) => {
        const next = { ...s }
        delete next[id]
        return next
      })
      return
    }
    debounceRef.current[id] = setTimeout(() => analyzeAnswer(id, question.title, value), 1500)
  }

  async function handleSubmit(status: 'draft' | 'submitted', consentJustAccepted = false) {
    if (Object.values(formData).every(isEmpty)) {
      toast.error(t('validation.answerRequired'))
      return
    }
    if (Object.values(analyzing).some(Boolean)) {
      toast.error(t('validation.waitForAnalysis'))
      return
    }
    if (status === 'submitted') {
      for (const question of schema) {
        if (question.required && isEmpty(formData[question.id])) {
          toast.error(t('validation.questionRequired', { title: question.title }))
          return
        }
      }
    }

    const scores = Object.values(aiScores)
    const payload: FormData = {
      ...formData,
      ...(scores.length > 0 && {
        _aiScores: aiScores,
        _overallAiScore: Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length),
      }),
      ...((consentAccepted || consentJustAccepted) && { _consentAccepted: true }),
    }

    setSubmitting(true)
    try {
      await onSubmit(payload, status)
    } finally {
      setSubmitting(false)
    }
  }

  function handleSubmitClick() {
    if (requireConsent && !viewMode && !consentAccepted) {
      setConsentGateOpen(true)
      return
    }
    handleSubmit('submitted')
  }

  function handleConsentAgree() {
    setConsentAccepted(true)
    setConsentGateOpen(false)
    handleSubmit('submitted', true)
  }

  const renderConsentDialog = () => (
    <Dialog open={consentGateOpen} onOpenChange={setConsentGateOpen}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('consent.dialogTitle')}</DialogTitle>
          <DialogDescription>{t('consent.dialogDescription')}</DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 min-h-0">
          {consentTermsText ? (
            <RichTextView html={consentTermsText} className="text-sm" />
          ) : (
            <p className="text-sm text-muted-foreground">{t('consent.noTermsProvided')}</p>
          )}
        </div>
        <div className="border-t pt-4 space-y-3">
          <label className="flex items-start gap-2 text-left">
            <Checkbox checked={consentChecked} onCheckedChange={(c) => setConsentChecked(!!c)} className="mt-0.5" />
            <span className="text-sm">{t('consent.checkboxLabel')}</span>
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConsentGateOpen(false)}>
              {t('actions.cancel')}
            </Button>
            <Button disabled={!consentChecked || submitting} onClick={handleConsentAgree}>
              {t('actions.agreeAndSubmit')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )

  // Detected purely from the schema's actual field ids, not `category` — a
  // regular custom form can legitimately be tagged category="onboarding"
  // (it's just one of the four picker options in Form Builder) without using
  // any of the standardized company-onboarding field ids below. Triggering
  // this structured layout for such a form filtered every question into
  // empty business/contact/consent/legal buckets and rendered nothing at
  // all — this is what "the form isn't shown" bug traced back to.
  const isOnboarding = schema.some(q => ['company_name', 'uen', 'industry', 'company_size'].includes(q.id))

  const businessIdentityIds = ['company_name', 'uen', 'industry', 'company_size']
  const primaryContactIds = ['full_name', 'role_in_business', 'email_address', 'mobile_number']
  const consentIds = ['whatsapp_consent', 'email_consent']
  const legalIds = ['platform_scope_ack', 'participation_authority_ack']

  const businessFields = schema.filter(q => businessIdentityIds.includes(q.id))
  const contactFields = schema.filter(q => primaryContactIds.includes(q.id))
  const consentFields = schema.filter(q => consentIds.includes(q.id))
  const legalFields = schema.filter(q => legalIds.includes(q.id))
  const otherFields = schema.filter(q => 
    !businessIdentityIds.includes(q.id) && 
    !primaryContactIds.includes(q.id) && 
    !consentIds.includes(q.id) && 
    !legalIds.includes(q.id)
  )

  if (isOnboarding) {
    return (
      <div className="space-y-6">
        {businessFields.length > 0 && (
          <div className="surface-card p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-lg">{t('onboarding.businessIdentityTitle')}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{t('onboarding.businessIdentitySubtitle')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {businessFields.map((question) => (
                <QuestionField
                  key={question.id}
                  question={question}
                  value={formData[question.id]}
                  onChange={(v) => handleChange(question.id, v)}
                  readOnly={readOnly}
                  viewMode={viewMode}
                  score={aiScores[question.id]}
                  analyzing={!!analyzing[question.id]}
                />
              ))}
            </div>
          </div>
        )}

        {contactFields.length > 0 && (
          <div className="surface-card p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-lg">{t('onboarding.primaryContactTitle')}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{t('onboarding.primaryContactSubtitle')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {contactFields.map((question) => (
                <QuestionField
                  key={question.id}
                  question={question}
                  value={formData[question.id]}
                  onChange={(v) => handleChange(question.id, v)}
                  readOnly={readOnly}
                  viewMode={viewMode}
                  score={aiScores[question.id]}
                  analyzing={!!analyzing[question.id]}
                />
              ))}
            </div>
          </div>
        )}

        {consentFields.length > 0 && (
          <div className="surface-card p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-lg">{t('onboarding.consentsTitle')}</h2>
            </div>
            <div className="space-y-4">
              {consentFields.map((question) => (
                <QuestionField
                  key={question.id}
                  question={question}
                  value={formData[question.id]}
                  onChange={(v) => handleChange(question.id, v)}
                  readOnly={readOnly}
                  viewMode={viewMode}
                  score={aiScores[question.id]}
                  analyzing={!!analyzing[question.id]}
                />
              ))}
            </div>
          </div>
        )}

        {legalFields.length > 0 && (
          <div className="surface-card p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-lg">{t('onboarding.legalTitle')}</h2>
            </div>
            <div className="space-y-4">
              {legalFields.map((question) => (
                <QuestionField
                  key={question.id}
                  question={question}
                  value={formData[question.id]}
                  onChange={(v) => handleChange(question.id, v)}
                  readOnly={readOnly}
                  viewMode={viewMode}
                  score={aiScores[question.id]}
                  analyzing={!!analyzing[question.id]}
                />
              ))}
            </div>
          </div>
        )}

        {otherFields.length > 0 && (
          <div className="surface-card p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-lg">{t('onboarding.additionalTitle')}</h2>
            </div>
            <div className="space-y-4">
              {otherFields.map((question) => (
                <QuestionField
                  key={question.id}
                  question={question}
                  value={formData[question.id]}
                  onChange={(v) => handleChange(question.id, v)}
                  readOnly={readOnly}
                  viewMode={viewMode}
                  score={aiScores[question.id]}
                  analyzing={!!analyzing[question.id]}
                />
              ))}
            </div>
          </div>
        )}

        {!hideActions && !readOnly && !viewMode && (
          <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t py-4 flex justify-end gap-2 z-20">
            <Button variant="outline" disabled={submitting} onClick={() => handleSubmit('draft')}>
              {t('actions.saveDraft')}
            </Button>
            <Button disabled={submitting} onClick={handleSubmitClick}>
              {t('actions.submitResponse')}
            </Button>
          </div>
        )}

        {renderConsentDialog()}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {schema.map((question) => (
        <QuestionField
          key={question.id}
          question={question}
          value={formData[question.id]}
          onChange={(v) => handleChange(question.id, v)}
          readOnly={readOnly}
          viewMode={viewMode}
          score={aiScores[question.id]}
          analyzing={!!analyzing[question.id]}
        />
      ))}

      {!hideActions && !readOnly && !viewMode && (
        <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t pt-4 flex justify-end gap-2">
          <Button variant="outline" disabled={submitting} onClick={() => handleSubmit('draft')}>
            {t('actions.saveDraft')}
          </Button>
          <Button disabled={submitting} onClick={handleSubmitClick}>
            {t('actions.submitResponse')}
          </Button>
        </div>
      )}

      {renderConsentDialog()}
    </div>
  )
}

// Monochrome by design — good/medium are differentiated by weight (solid vs
// dashed), not hue; "bad" keeps the app's one retained color (destructive
// red), the same safety-critical exception used for delete/error states.
function scoreColorClasses(color: AnswerScore['color']) {
  if (color === 'green') return 'bg-foreground/5 text-foreground border-foreground/30 font-semibold'
  if (color === 'yellow') return 'bg-transparent text-foreground/70 border-dashed border-foreground/40'
  return 'bg-destructive/10 text-destructive border-destructive/30'
}

function AiFeedbackCard({ score, onApplySuggestion, readOnly }: { score: AnswerScore; onApplySuggestion: () => void; readOnly?: boolean }) {
  const { t } = useTranslation('dynamicForm')
  const showSuggestion = score.rephrasedAnswer && score.rephrasedAnswer.trim().length > 0

  return (
    <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> {t('aiFeedback.label')}
        </div>
        <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', scoreColorClasses(score.color))}>
          {score.feedback} · {score.score}
        </span>
      </div>

      {score.reasoning && <p className="text-sm text-muted-foreground">{score.reasoning}</p>}

      {showSuggestion && (
        <div className="space-y-2 rounded-lg border bg-background p-3">
          <p className="text-xs font-medium text-muted-foreground">{t('aiFeedback.suggestedRewrite')}</p>
          <p className="text-sm italic">"{score.rephrasedAnswer}"</p>
          {!readOnly && (
            <Button type="button" size="sm" variant="outline" onClick={onApplySuggestion}>
              {t('actions.applySuggestion')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function QuestionField({
  question,
  value,
  onChange,
  readOnly,
  viewMode,
  score,
  analyzing,
}: {
  question: FormQuestion
  value: unknown
  onChange: (value: unknown) => void
  readOnly?: boolean
  viewMode?: boolean
  score?: AnswerScore
  analyzing?: boolean
}) {
  const { t } = useTranslation('dynamicForm')
  const showAiScore = (question.type === 'short_text' || question.type === 'long_text') && !viewMode

  const translatedTitle = translateString(question.title, t)
  const translatedHelpText = question.helpText ? translateString(question.helpText, t) : undefined

  if (viewMode) {
    return (
      <div className="space-y-1 border-b pb-4 last:border-0">
        <p className="text-sm font-medium text-muted-foreground">{translatedTitle}</p>
        {question.type === 'editable_table' ? (
          <EditableTable question={question} value={(value as EditableTableRow[]) ?? []} onChange={() => {}} readOnly viewMode />
        ) : (
          <p className="text-sm">{translateString(formatAnswerForView(value), t)}</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label>
          {translatedTitle}
          {question.required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        {showAiScore && analyzing && <span className="text-xs text-muted-foreground">{t('fields.analyzing')}</span>}
      </div>
      {translatedHelpText && <p className="text-xs text-muted-foreground">{translatedHelpText}</p>}

      {question.type === 'short_text' && (
        <Input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} disabled={readOnly} />
      )}
      {question.type === 'long_text' && (
        <Textarea rows={4} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} disabled={readOnly} />
      )}
      {showAiScore && score && !analyzing && (
        <AiFeedbackCard score={score} onApplySuggestion={() => onChange(score.rephrasedAnswer)} readOnly={readOnly} />
      )}
      {question.type === 'number' && (
        <NumericInput allowDecimal allowNegative value={(value as string) ?? ''} onChange={onChange} disabled={readOnly} />
      )}
      {question.type === 'date' && (
        <Input type="date" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} disabled={readOnly} />
      )}
      {question.type === 'dropdown' && (
        <Select value={(value as string) ?? ''} onValueChange={(v) => v && onChange(v)}>
          <SelectTrigger disabled={readOnly}>
            <SelectValue placeholder={t('fields.selectPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {(question.options ?? []).map((opt) => (
              <SelectItem key={opt.label} value={opt.label}>
                {translateString(opt.label, t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {question.type === 'single_choice' && (
        <RadioGroup value={(value as string) ?? ''} onValueChange={(v) => v && onChange(v)} className="flex flex-row flex-wrap gap-4 mt-2">
          {(question.options ?? []).map((opt) => (
            <label key={opt.label} className="flex items-center gap-2 text-sm cursor-pointer font-normal">
              <RadioGroupItem value={opt.label} disabled={readOnly} />
              {translateString(opt.label, t)}
            </label>
          ))}
        </RadioGroup>
      )}
      {question.type === 'multiple_choice' &&
        (() => {
          const selected = Array.isArray(value) ? (value as string[]) : []
          return (
            <div className="space-y-3">
              {(question.options ?? []).map((opt) => (
                <label key={opt.label} className="flex items-start gap-2.5 cursor-pointer text-sm font-normal">
                  <Checkbox
                    checked={selected.includes(opt.label)}
                    disabled={readOnly}
                    onCheckedChange={(checked) =>
                      onChange(checked ? [...selected, opt.label] : selected.filter((v) => v !== opt.label))
                    }
                    className="mt-0.5"
                  />
                  <span>{translateString(opt.label, t)}</span>
                </label>
              ))}
            </div>
          )
        })()}
      {question.type === 'editable_table' && (
        <EditableTable question={question} value={(value as EditableTableRow[]) ?? []} onChange={onChange} readOnly={readOnly} />
      )}
    </div>
  )
}

function formatAnswerForView(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

function EditableTable({
  question,
  value,
  onChange,
  readOnly,
  viewMode,
}: {
  question: FormQuestion
  value: EditableTableRow[]
  onChange: (rows: EditableTableRow[]) => void
  readOnly?: boolean
  viewMode?: boolean
}) {
  const { t } = useTranslation('dynamicForm')
  const columns = question.columns ?? []
  const initialRows = value.length > 0 ? value : question.defaultRows && question.defaultRows.length > 0 ? question.defaultRows : question.allowAddRows !== false ? [{ id: `row_${Date.now()}` }] : []
  const rows = Array.isArray(initialRows) ? initialRows : [{ id: `row_${Date.now()}` }]
  const canAddRemove = question.allowAddRows !== false

  function handleCellChange(rowIndex: number, colId: string, val: unknown) {
    const next = rows.map((r, i) => (i === rowIndex ? { ...r, [colId]: val } : r))
    onChange(next)
  }

  function addRow() {
    onChange([...rows, { id: `row_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, _userAdded: true }])
  }

  function removeRow(rowIndex: number) {
    const next = rows.filter((_, i) => i !== rowIndex)
    onChange(next.length > 0 ? next : [{ id: `row_${Date.now()}` }])
  }

  // Partition rows into section blocks (each starting with an isSectionHeader row).
  const blocks: Array<{ header: EditableTableRow | null; rows: Array<{ row: EditableTableRow; index: number }> }> = []
  let current: { header: EditableTableRow | null; rows: Array<{ row: EditableTableRow; index: number }> } = { header: null, rows: [] }
  rows.forEach((r, idx) => {
    if (r.isSectionHeader) {
      if (current.header || current.rows.length > 0) blocks.push(current)
      current = { header: r, rows: [] }
    } else {
      current.rows.push({ row: r, index: idx })
    }
  })
  blocks.push(current)

  // Pre-pass: compute per-section summaries, exposing sectionSummaryVariable to later sections.
  const contextVariables: Record<string, string> = {}
  for (const block of blocks) {
    const header = block.header
    if (header?.isSectionHeader && header.sectionEnableSummary && header.sectionSummaryFormula) {
      let resolvedFormula = header.sectionSummaryFormula
      for (const col of columns) {
        if (col.label && col.id && col.label !== col.id) {
          const escaped = col.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          resolvedFormula = resolvedFormula.replace(new RegExp(`SUM\\(\\s*${escaped}\\s*\\)`, 'gi'), `SUM(${col.id})`)
        }
      }
      const sectionRows = block.rows.map((r) => r.row)
      const val = evaluateFormula(resolvedFormula, sectionRows, '', 0, contextVariables)
      header._calculatedSummary = val
      if (header.sectionSummaryVariable) contextVariables[header.sectionSummaryVariable] = val
    }
  }

  const numberColIdx = columns.findIndex((c) => c.type === 'number')
  const currencyCol = columns.find((c) => c.type === 'number' && c.format === 'currency')

  function renderCell(row: EditableTableRow, rowIndex: number, col: EditableTableColumn) {
    const rawValue = row[col.id]
    const cellConfig = row._cellConfigs?.[col.id]
    const isFormula = typeof rawValue === 'string' && rawValue.startsWith('=')
    const resolvedValue = isFormula ? evaluateFormula(rawValue as string, rows, col.id, 0, contextVariables, row) : rawValue
    const isLabelLocked = col.type === 'label' && !row._userAdded
    const currencyPrefix =
      col.type === 'number' && col.format === 'currency' && !cellConfig?.hideCurrency && !['True', 'False', '#INVALID!', '#ERROR!', '#RECURSION!'].includes(String(resolvedValue))
        ? col.currencySymbol || '$'
        : ''

    if (viewMode || isFormula || isLabelLocked) {
      return (
        <div className="text-sm py-1.5">
          {currencyPrefix}
          {resolvedValue !== undefined && resolvedValue !== null && resolvedValue !== '' ? String(resolvedValue) : '—'}
        </div>
      )
    }

    const disabled = readOnly

    if (col.type === 'select' || cellConfig?.type === 'select') {
      const options = cellConfig?.options ?? col.options ?? []
      return (
        <Select value={(rawValue as string) ?? ''} onValueChange={(v) => v && handleCellChange(rowIndex, col.id, v)}>
          <SelectTrigger disabled={disabled}>
            <SelectValue placeholder={t('fields.selectPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.label} value={opt.label}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }
    if (col.type === 'checkbox') {
      return <Checkbox checked={!!rawValue} disabled={disabled} onCheckedChange={(c) => handleCellChange(rowIndex, col.id, c)} />
    }
    if (col.type === 'radio') {
      return (
        <RadioGroup value={(rawValue as string) ?? ''} onValueChange={(v) => v && handleCellChange(rowIndex, col.id, v)}>
          {(col.options ?? []).map((opt) => (
            <label key={opt.label} className="flex items-center gap-1.5 text-xs">
              <RadioGroupItem value={opt.label} disabled={disabled} /> {opt.label}
            </label>
          ))}
        </RadioGroup>
      )
    }
    if (col.type === 'date') {
      return <Input type="date" value={(rawValue as string) ?? ''} onChange={(e) => handleCellChange(rowIndex, col.id, e.target.value)} disabled={disabled} />
    }
    if (col.type === 'number') {
      return (
        <div className="flex items-center gap-1">
          {currencyPrefix && <span className="text-sm text-muted-foreground">{currencyPrefix}</span>}
          <NumericInput
            allowDecimal
            allowNegative
            value={(rawValue as string) ?? ''}
            onChange={(v) => handleCellChange(rowIndex, col.id, v)}
            disabled={disabled}
          />
        </div>
      )
    }
    return <Input value={(rawValue as string) ?? ''} onChange={(e) => handleCellChange(rowIndex, col.id, e.target.value)} disabled={disabled} />
  }

  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.id}>{col.label}</TableHead>
            ))}
            {!viewMode && canAddRemove && !readOnly && <TableHead className="w-10" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {blocks.map((block, blockIdx) => (
            <Fragment key={blockIdx}>
              {block.header && (
                <TableRow key={`header-${blockIdx}`} className="bg-muted/50">
                  <TableCell colSpan={columns.length + 1} className={cn('font-semibold', block.header.sectionLevel === 3 && 'text-sm', block.header.sectionLevel === 2 && 'text-base')}>
                    {block.header.sectionLabel}
                  </TableCell>
                </TableRow>
              )}
              {block.rows.map(({ row, index }) => (
                <TableRow key={row.id || index}>
                  {columns.map((col) => (
                    <TableCell key={col.id}>{renderCell(row, index, col)}</TableCell>
                  ))}
                  {!viewMode && canAddRemove && !readOnly && (
                    <TableCell>
                      <Button variant="ghost" size="icon-sm" onClick={() => removeRow(index)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {block.header?.isSectionHeader && block.header.sectionEnableSummary && (
                <TableRow key={`summary-${blockIdx}`} className="bg-muted/50 font-medium">
                  {columns.map((col, cIdx) => {
                    if (cIdx === 0) return <TableCell key={col.id}>{block.header!.sectionSummaryLabel || t('table.sectionTotal')}</TableCell>
                    if (cIdx === numberColIdx) return <TableCell key={col.id}>{currencyCol?.currencySymbol || '$'}{String(block.header!._calculatedSummary ?? '—')}</TableCell>
                    return <TableCell key={col.id} />
                  })}
                  {!viewMode && canAddRemove && !readOnly && <TableCell />}
                </TableRow>
              )}
            </Fragment>
          ))}
        </TableBody>
        {question.summaryRow?.enabled && (
          <tfoot>
            <TableRow className="bg-primary/5 font-medium">
              {(() => {
                const labelSpan = question.summaryRow.labelColSpan ?? 1
                const sumCol = columns.find((c) => c.id === question.summaryRow!.valueColId)
                let total: string
                if (question.summaryRow.formula) {
                  total = evaluateFormula(question.summaryRow.formula, rows, question.summaryRow.valueColId || '', 0, contextVariables)
                } else if (sumCol) {
                  const sum = rows.reduce((acc, r) => {
                    const raw = r[sumCol.id]
                    const num = typeof raw === 'string' && raw.startsWith('=') ? parseFloat(evaluateFormula(raw, rows, sumCol.id, 0, contextVariables, r)) : parseFloat(String(raw))
                    return acc + (isNaN(num) ? 0 : num)
                  }, 0)
                  total = sum.toLocaleString()
                } else {
                  total = '0'
                }
                return (
                  <>
                    <TableCell colSpan={labelSpan} className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" /> {question.summaryRow.label || t('table.total')}
                    </TableCell>
                    <TableCell colSpan={columns.length - labelSpan}>
                      {sumCol?.format === 'currency' ? sumCol.currencySymbol || '$' : ''}
                      {total}
                    </TableCell>
                    {!viewMode && canAddRemove && !readOnly && <TableCell />}
                  </>
                )
              })()}
            </TableRow>
          </tfoot>
        )}
      </Table>
      {!viewMode && canAddRemove && !readOnly && (
        <div className="p-2 border-t">
          <Button variant="ghost" size="sm" onClick={addRow}>
            <Plus className="h-3.5 w-3.5" /> {t('actions.addRow')}
          </Button>
        </div>
      )}
    </div>
  )
}
