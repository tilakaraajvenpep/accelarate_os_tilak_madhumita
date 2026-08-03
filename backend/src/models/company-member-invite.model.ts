import { pgTable, serial, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'
import { companies } from './company.model'
import { users } from './user.model'

export const companyMemberInvites = pgTable('company_member_invites', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id')
    .notNull()
    .references(() => tenants.id),
  companyId: integer('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  code: text('code').notNull(),
  consumed: boolean('consumed').notNull().default(false),
  invitedByUserId: integer('invited_by_user_id').references(() => users.id),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type CompanyMemberInvite = typeof companyMemberInvites.$inferSelect
export type NewCompanyMemberInvite = typeof companyMemberInvites.$inferInsert
