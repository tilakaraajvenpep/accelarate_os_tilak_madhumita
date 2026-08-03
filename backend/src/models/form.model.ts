import { pgTable, serial, integer, text, timestamp, pgEnum, jsonb } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'

export const formStatusEnum = pgEnum('form_status', ['active', 'inactive'])

export type SimpleQuestionType = 'short_text' | 'long_text' | 'number' | 'single_choice' | 'multiple_choice' | 'date'

// Deliberately simpler than form-template.model.ts's FormQuestion (that system's
// editable-table/AI-scoring/consent-gate features are irrelevant here) — just
// enough to ask founders a handful of questions per section.
export interface SimpleFormQuestion {
  id: string
  title: string
  type: SimpleQuestionType
  required?: boolean
  helpText?: string | null
  options?: string[] // single_choice / multiple_choice only
}

export const forms = pgTable('forms', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  status: formStatusEnum('status').notNull().default('active'),
  schema: jsonb('schema').$type<SimpleFormQuestion[]>().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Form = typeof forms.$inferSelect
export type NewForm = typeof forms.$inferInsert
