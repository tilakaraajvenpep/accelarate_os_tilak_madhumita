export type QuestionType =
  | 'short_text'
  | 'long_text'
  | 'number'
  | 'dropdown'
  | 'single_choice'
  | 'multiple_choice'
  | 'date'
  | 'editable_table'

export interface FormQuestionOption {
  label: string
  score: number
}

export interface EditableTableColumn {
  id: string
  label: string
  type: 'text' | 'number' | 'select' | 'label' | 'radio' | 'checkbox' | 'date'
  options?: FormQuestionOption[]
  format?: 'currency' | 'number' | 'text'
  currencySymbol?: string
}

export interface EditableTableRow {
  id: string
  isDefaultRow?: boolean
  isFormulaRow?: boolean
  isSectionHeader?: boolean
  sectionLabel?: string
  sectionLevel?: 1 | 2 | 3
  sectionAllowAddRows?: boolean
  sectionEnableSummary?: boolean
  sectionSummaryLabel?: string
  sectionSummaryFormula?: string
  sectionSummaryVariable?: string
  _userAdded?: boolean
  _cellConfigs?: Record<string, { type?: 'select'; options?: FormQuestionOption[]; hideCurrency?: boolean }>
  [cellValue: string]: unknown
}

export interface FormQuestion {
  id: string
  title: string
  type: QuestionType
  required?: boolean
  helpText?: string | null
  // Only meaningful for dropdown/single_choice/multiple_choice — each option
  // carries its own score so a form can be a weighted rubric, not just a survey.
  options?: FormQuestionOption[] | null
  // editable_table-only fields:
  columns?: EditableTableColumn[]
  defaultRows?: EditableTableRow[]
  allowAddRows?: boolean
  summaryRow?: {
    enabled: boolean
    label?: string
    labelColSpan?: number
    valueColId?: string
    formula?: string
  }
}

// Freeform, not a strict union — categories grow organically (pillar_diagnostic,
// governance_review, onboarding, feedback, ...).
export type FormCategory = string

export interface FormTemplateSummary {
  id: number
  title: string
  description: string | null
  category: FormCategory
  isArchived: boolean
  isMultipleEntry: boolean
  requireConsent: boolean
  consentTermsText: string | null
  version: number
  // Version lineage — null on a template that's never been forked.
  // supersededByFormId set = an older version, no longer editable/assignable.
  rootTemplateId: number | null
  previousVersionId: number | null
  supersededByFormId: number | null
  createdAt: string
  updatedAt: string
}

export interface FormTemplateDetail extends FormTemplateSummary {
  schema: FormQuestion[]
}

export interface FormImpactPreview {
  willFork: boolean
  responseCount?: number
  companyCount?: number
  nextVersion?: number
}

export interface FormTemplateResponseRow {
  formId: number
  companyId: number
  companyName: string
  founderName: string
  status: 'draft' | 'submitted'
  submittedAt: string | null
  responseJson: Record<string, unknown>
  version: number | null
  answers: { questionId: string; questionTitle: string; value: unknown }[]
  // null when the form doesn't require consent at all — otherwise whether this founder accepted it.
  consentAccepted: boolean | null
}

export interface FormTemplateResponsesResult {
  template: { id: number; title: string; version: number }
  responses: FormTemplateResponseRow[]
}

export interface FormMapping {
  id: number
  templateId: number
  cohortId: number | null
  type: string
  contextId: string
  sectionId: string
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Pillar {
  pillarNumber: number
  title: string
  status: 'locked' | 'unlocked' | 'completed'
  completionPercentage: number
}

export interface PillarDefinition {
  pillarNumber: number
  title: string | null
}

export interface FormResponse {
  id: number
  templateId: number
  mappingId: number
  companyId: number
  responseJson: Record<string, unknown>
  status: 'draft' | 'submitted'
  submittedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface FormResponseInstance {
  mappingId: number
  sectionId: string
  template: FormTemplateDetail
  hasResponse: boolean
  response: FormResponse | null
}

export interface CompanyMember {
  userId: number
  email: string
  name: string | null
  joinedAt: string
  allowedMenus?: string[] | null
  canSetPermissions?: boolean
}

export interface AnswerScore {
  score: number
  color: 'red' | 'yellow' | 'green'
  feedback: string
  reasoning: string
  rephrasedAnswer: string
}
