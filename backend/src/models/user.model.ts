import { pgTable, serial, text, timestamp, pgEnum } from 'drizzle-orm/pg-core'

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
  tenantId: text('tenant_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
