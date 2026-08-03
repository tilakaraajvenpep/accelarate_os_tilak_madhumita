import { pgTable, serial, integer, text, timestamp, pgEnum, boolean } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'

export const programStatusEnum = pgEnum('program_status', ['active', 'inactive'])

export const programs = pgTable('programs', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id')
    .notNull()
    .references(() => tenants.id),
  name: text('name').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  status: programStatusEnum('status').notNull().default('active'),
  // Tenant admin can lock a program to block founder access without deleting
  // it — see backend/src/services/founder-programs.service.ts for enforcement.
  locked: boolean('locked').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Program = typeof programs.$inferSelect
export type NewProgram = typeof programs.$inferInsert
