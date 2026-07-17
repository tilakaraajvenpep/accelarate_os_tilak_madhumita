import { pgTable, serial, text, integer, timestamp } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'
import { users } from './user.model'

export const companies = pgTable('companies', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id')
    .notNull()
    .references(() => tenants.id),
  // One company per founder, one founder per company — set once, when the
  // invited founder completes their company-details form after signup.
  founderUserId: integer('founder_user_id')
    .notNull()
    .unique()
    .references(() => users.id),
  name: text('name').notNull(),
  location: text('location'),
  establishedYear: integer('established_year'),
  founderName: text('founder_name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Company = typeof companies.$inferSelect
export type NewCompany = typeof companies.$inferInsert
