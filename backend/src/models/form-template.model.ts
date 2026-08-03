import { pgTable, serial, text, integer, boolean, jsonb, timestamp, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'
import { users } from './user.model'

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

export const formTemplates = pgTable('form_templates', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id')
    .notNull()
    .references(() => tenants.id),
  title: text('title').notNull(),
  description: text('description'),
  // Freeform, not a strict enum — categories grow organically (pillar_diagnostic,
  // governance_review, onboarding, feedback, ...) without needing a migration each time.
  category: text('category').notNull(),
  schema: jsonb('schema').$type<FormQuestion[]>().notNull().default([]),
  isArchived: boolean('is_archived').notNull().default(false),
  isMultipleEntry: boolean('is_multiple_entry').notNull().default(false),
  // When true, founders must read consentTermsText and tick a checkbox
  // before the form's fields become usable at all (enforced client-side).
  requireConsent: boolean('require_consent').notNull().default(false),
  consentTermsText: text('consent_terms_text'),
  version: integer('version').notNull().default(1),
  // Version lineage — self-references so `form_templates.id` stays the one
  // stable identity everything else (section_forms, cohort_forms, responses)
  // points at, even across a fork. rootTemplateId groups every version of
  // "the same form"; previousVersionId/supersededByFormId form the doubly
  // linked chain between one version and the next.
  rootTemplateId: integer('root_template_id').references((): AnyPgColumn => formTemplates.id),
  previousVersionId: integer('previous_version_id').references((): AnyPgColumn => formTemplates.id),
  supersededByFormId: integer('superseded_by_form_id').references((): AnyPgColumn => formTemplates.id),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type FormTemplate = typeof formTemplates.$inferSelect
export type NewFormTemplate = typeof formTemplates.$inferInsert
