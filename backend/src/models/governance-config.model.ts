import { pgTable, serial, integer, text, jsonb, timestamp } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'
import { cohorts } from './cohort.model'

// Tenant-admin-defined template for a governance review cycle: which of the
// tenant's dynamic pillars (by pillarNumber, see pillar.model.ts's
// companyPillars) are in scope, and what the review is for.
export const governanceConfigs = pgTable('governance_configs', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id')
    .notNull()
    .references(() => tenants.id),
  cohortId: integer('cohort_id').references(() => cohorts.id),
  applicablePillars: jsonb('applicable_pillars').notNull().default([]), // number[] of pillarNumbers
  purpose: text('purpose'),
  promptTemplates: jsonb('prompt_templates').notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type GovernanceConfig = typeof governanceConfigs.$inferSelect
export type NewGovernanceConfig = typeof governanceConfigs.$inferInsert
