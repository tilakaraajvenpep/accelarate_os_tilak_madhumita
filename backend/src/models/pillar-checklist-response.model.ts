import { pgTable, serial, integer, text, boolean, timestamp, unique } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'
import { companies } from './company.model'
import { pillarChecklistQuestions } from './pillar-checklist-question.model'

// A company's answer to one readiness-checklist question. answerText is used
// for 'text' questions, answerBool for 'checkbox' questions.
export const pillarChecklistResponses = pgTable(
  'pillar_checklist_responses',
  {
    id: serial('id').primaryKey(),
    tenantId: integer('tenant_id').notNull().references(() => tenants.id),
    companyId: integer('company_id').notNull().references(() => companies.id),
    questionId: integer('question_id').notNull().references(() => pillarChecklistQuestions.id),
    answerText: text('answer_text'),
    answerBool: boolean('answer_bool'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [unique().on(table.companyId, table.questionId)],
)

export type PillarChecklistResponse = typeof pillarChecklistResponses.$inferSelect
export type NewPillarChecklistResponse = typeof pillarChecklistResponses.$inferInsert
