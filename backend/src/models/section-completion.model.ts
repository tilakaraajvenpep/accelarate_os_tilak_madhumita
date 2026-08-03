import { pgTable, serial, integer, timestamp, unique } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'
import { companies } from './company.model'
import { sections } from './section.model'

// Explicit "mark as done" for a section that has no forms attached — those
// can't be completed by submitting anything, so the founder marks them
// complete directly instead of it happening silently/automatically.
export const sectionCompletions = pgTable(
  'section_completions',
  {
    id: serial('id').primaryKey(),
    tenantId: integer('tenant_id').notNull().references(() => tenants.id),
    companyId: integer('company_id').notNull().references(() => companies.id),
    sectionId: integer('section_id').notNull().references(() => sections.id),
    completedAt: timestamp('completed_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [unique().on(table.companyId, table.sectionId)],
)

export type SectionCompletion = typeof sectionCompletions.$inferSelect
export type NewSectionCompletion = typeof sectionCompletions.$inferInsert
