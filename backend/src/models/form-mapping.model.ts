import { pgTable, serial, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'
import { formTemplates } from './form-template.model'
import { cohorts } from './cohort.model'

export const formMappings = pgTable('form_mappings', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id')
    .notNull()
    .references(() => tenants.id),
  templateId: integer('template_id')
    .notNull()
    .references(() => formTemplates.id, { onDelete: 'cascade' }),
  // Null = applies to every cohort in the tenant.
  cohortId: integer('cohort_id').references(() => cohorts.id),
  // Freeform, matching form_templates.category (pillar_diagnostic/governance_review/onboarding/feedback).
  type: text('type').notNull(),
  // e.g. pillar number "1"-"6", or "Startup" for a non-pillar-scoped mapping.
  contextId: text('context_id').notNull(),
  // e.g. "A"/"B"/"C" — sub-section within the context. Empty string = whole context.
  sectionId: text('section_id').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type FormMapping = typeof formMappings.$inferSelect
export type NewFormMapping = typeof formMappings.$inferInsert
