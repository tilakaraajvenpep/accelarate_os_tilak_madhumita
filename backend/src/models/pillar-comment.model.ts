import { pgTable, serial, integer, text, timestamp } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'
import { companies } from './company.model'
import { pillars } from './pillar.model'
import { users } from './user.model'

// Append-only discussion feed on a company's pillar, shared between the
// company's founders/teammates and any mentor assigned to that pillar.
export const pillarComments = pgTable('pillar_comments', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id),
  companyId: integer('company_id').notNull().references(() => companies.id),
  pillarId: integer('pillar_id').notNull().references(() => pillars.id),
  authorUserId: integer('author_user_id').notNull().references(() => users.id),
  authorRole: text('author_role').notNull(), // 'founder' | 'mentor'
  body: text('body').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type PillarComment = typeof pillarComments.$inferSelect
export type NewPillarComment = typeof pillarComments.$inferInsert
