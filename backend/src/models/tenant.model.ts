import { pgTable, serial, text, timestamp, pgEnum, boolean } from 'drizzle-orm/pg-core'

export const orgTypeEnum = pgEnum('org_type', [
  'university',
  'corporate',
  'vc_backed',
  'government',
  'independent',
  'other',
])

export const tenants = pgTable('tenants', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  orgType: orgTypeEnum('org_type'),
  website: text('website'),
  suspended: boolean('suspended').notNull().default(false),
  emailServiceEnabled: boolean('email_service_enabled').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Tenant = typeof tenants.$inferSelect
export type NewTenant = typeof tenants.$inferInsert
