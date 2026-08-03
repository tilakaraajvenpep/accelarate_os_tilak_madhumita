import { pgTable, serial, integer, timestamp, unique } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'
import { programs } from './program.model'
import { companies } from './company.model'

// The persisted "this company just finished this program" event — nothing
// else in the app stores this; program completion is otherwise recomputed
// live on every read (see founder-programs.service.ts). Existence of a row
// here is the one-shot guard against re-firing the feedback-form trigger.
export const programCompletions = pgTable(
  'program_completions',
  {
    id: serial('id').primaryKey(),
    tenantId: integer('tenant_id')
      .notNull()
      .references(() => tenants.id),
    programId: integer('program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    completedAt: timestamp('completed_at').defaultNow().notNull(),
  },
  (table) => [unique().on(table.programId, table.companyId)],
)

export type ProgramCompletion = typeof programCompletions.$inferSelect
export type NewProgramCompletion = typeof programCompletions.$inferInsert
