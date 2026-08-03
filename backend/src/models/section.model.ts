import { pgTable, serial, integer, text, timestamp, pgEnum, boolean } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'

export const sectionStatusEnum = pgEnum('section_status', ['active', 'inactive'])

export const sections = pgTable('sections', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id')
    .notNull()
    .references(() => tenants.id),
  title: text('title').notNull(),
  description: text('description'),
  status: sectionStatusEnum('status').notNull().default('active'),
  // Consent to schedule this section onto a cohort's calendar for a specific
  // date — asked when the section is created (moved here from the program).
  showInCalendar: boolean('show_in_calendar').notNull().default(false),
  // Tenant admin can lock a section to block founder access without deleting it.
  locked: boolean('locked').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Section = typeof sections.$inferSelect
export type NewSection = typeof sections.$inferInsert
