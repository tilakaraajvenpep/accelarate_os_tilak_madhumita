import { pgTable, serial, text, timestamp, pgEnum, integer } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'
import { roleEnum } from './user.model'

export const inviteStatusEnum = pgEnum('invite_status', ['pending', 'accepted', 'expired'])

export const tenantInvites = pgTable('tenant_invites', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id),
  email: text('email').notNull(),
  name: text('name'),
  role: roleEnum('role').notNull().default('admin'),
  token: text('token').notNull().unique(),
  status: inviteStatusEnum('status').notNull().default('pending'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type TenantInvite = typeof tenantInvites.$inferSelect
export type NewTenantInvite = typeof tenantInvites.$inferInsert
