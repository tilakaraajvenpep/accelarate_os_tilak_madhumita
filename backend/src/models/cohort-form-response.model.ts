import { pgTable, serial, integer, text, jsonb, timestamp, unique } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'
import { cohorts } from './cohort.model'
import { companies } from './company.model'
import { formTemplates } from './form-template.model'
import { users } from './user.model'

/**
 * One company's answer to a cohort-attached form — one row per
 * (cohortId, formId, companyId). claimedByUserId records which single
 * founder on the company's team is allowed to fill it in (set the first
 * time anyone on the team saves a response), so co-founders can't
 * overwrite each other's answers.
 */
export const cohortFormResponses = pgTable(
  'cohort_form_responses',
  {
    id: serial('id').primaryKey(),
    tenantId: integer('tenant_id').notNull().references(() => tenants.id),
    cohortId: integer('cohort_id').notNull().references(() => cohorts.id),
    formId: integer('form_id').notNull().references(() => formTemplates.id),
    companyId: integer('company_id').notNull().references(() => companies.id),
    claimedByUserId: integer('claimed_by_user_id').references(() => users.id),
    responseJson: jsonb('response_json').notNull().default({}),
    status: text('status').notNull().default('draft'), // 'draft' | 'submitted'
    submittedAt: timestamp('submitted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [unique().on(table.cohortId, table.formId, table.companyId)],
)

export type CohortFormResponse = typeof cohortFormResponses.$inferSelect
export type NewCohortFormResponse = typeof cohortFormResponses.$inferInsert
