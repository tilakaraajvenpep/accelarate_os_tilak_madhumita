import { pgTable, serial, integer, timestamp, unique } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'
import { companies } from './company.model'
import { users } from './user.model'

export const companyMembers = pgTable(
  'company_members',
  {
    id: serial('id').primaryKey(),
    tenantId: integer('tenant_id')
      .notNull()
      .references(() => tenants.id),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [unique().on(table.companyId, table.userId)],
)

export type CompanyMember = typeof companyMembers.$inferSelect
export type NewCompanyMember = typeof companyMembers.$inferInsert
