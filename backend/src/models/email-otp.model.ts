import { pgTable, serial, text, timestamp, boolean } from 'drizzle-orm/pg-core'

export const emailOtps = pgTable('email_otps', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  code: text('code').notNull(),
  consumed: boolean('consumed').notNull().default(false),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type EmailOtp = typeof emailOtps.$inferSelect
export type NewEmailOtp = typeof emailOtps.$inferInsert
