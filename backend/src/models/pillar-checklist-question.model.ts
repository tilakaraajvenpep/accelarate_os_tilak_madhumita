import { pgTable, serial, integer, text, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'
import { pillars } from './pillar.model'

export const pillarChecklistQuestionTypeEnum = pgEnum('pillar_checklist_question_type', ['text', 'checkbox'])

// Admin-authored readiness-checklist questions for a pillar (only relevant
// when pillars.hasReadinessChecklist is true) — founders answer these via
// pillar_checklist_responses.
export const pillarChecklistQuestions = pgTable('pillar_checklist_questions', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id),
  pillarId: integer('pillar_id').notNull().references(() => pillars.id),
  prompt: text('prompt').notNull(),
  type: pillarChecklistQuestionTypeEnum('type').notNull().default('text'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type PillarChecklistQuestion = typeof pillarChecklistQuestions.$inferSelect
export type NewPillarChecklistQuestion = typeof pillarChecklistQuestions.$inferInsert
