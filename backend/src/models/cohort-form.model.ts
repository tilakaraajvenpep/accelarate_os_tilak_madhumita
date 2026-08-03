import { pgTable, serial, integer, text, timestamp, unique } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'
import { cohorts } from './cohort.model'
import { formTemplates } from './form-template.model'

/**
 * Which Assessment Form templates are attached to a whole cohort (as opposed
 * to a single section) — visible to every company in the cohort, but only
 * one founder per company may fill it in (see cohort_form_responses).
 * fillPolicy controls who that is: 'primary_founder' = the company's
 * original founder (companies.founderUserId) only; 'first_claim' = whichever
 * team member saves a response first.
 */
export const cohortForms = pgTable(
  'cohort_forms',
  {
    id: serial('id').primaryKey(),
    tenantId: integer('tenant_id').notNull().references(() => tenants.id),
    cohortId: integer('cohort_id').notNull().references(() => cohorts.id),
    formId: integer('form_id').notNull().references(() => formTemplates.id),
    fillPolicy: text('fill_policy').notNull().default('primary_founder'), // 'primary_founder' | 'first_claim'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [unique().on(table.cohortId, table.formId)],
)

export type CohortForm = typeof cohortForms.$inferSelect
export type NewCohortForm = typeof cohortForms.$inferInsert
