import { pgTable, serial, integer, text, date, timestamp } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'

export const cohorts = pgTable('cohorts', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Cohort = typeof cohorts.$inferSelect
export type NewCohort = typeof cohorts.$inferInsert
