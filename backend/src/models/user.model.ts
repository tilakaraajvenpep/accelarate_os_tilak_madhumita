import { pgTable, serial, text, timestamp, pgEnum, integer, boolean, jsonb } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'

export const roleEnum = pgEnum('role', [
  'founder',
  'admin',
  'super_admin',
  'mentor',
  'funding_team',
])

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  cognitoSub: text('cognito_sub').unique(),
  email: text('email').notNull().unique(),
  name: text('name'),
  role: roleEnum('role').notNull().default('founder'),
  tenantId: integer('tenant_id').references(() => tenants.id),
  emailVerified: boolean('email_verified').notNull().default(true),
  disabled: boolean('disabled').notNull().default(false),
  // Self-service: a tenant admin can flag themselves as available to be
  // picked as a mentor for a pillar, without needing a separate mentor
  // account (see mentors.service.ts's listEligibleMentors).
  interestedInMentoring: boolean('interested_in_mentoring').notNull().default(false),
  allowedMenus: jsonb('allowed_menus'),
  canSetPermissions: boolean('can_set_permissions').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
