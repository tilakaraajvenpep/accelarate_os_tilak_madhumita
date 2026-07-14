import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

export const superAdminInvites = pgTable('super_admin_invites', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  codeHash: text('code_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type SuperAdminInvite = typeof superAdminInvites.$inferSelect
export type NewSuperAdminInvite = typeof superAdminInvites.$inferInsert
