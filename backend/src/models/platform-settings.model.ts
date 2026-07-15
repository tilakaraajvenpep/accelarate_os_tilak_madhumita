import { pgTable, serial, boolean, integer, text, timestamp } from 'drizzle-orm/pg-core'

export const platformSettings = pgTable('platform_settings', {
  id: serial('id').primaryKey(),
  allowExpiryOverride: boolean('allow_expiry_override').notNull().default(true),
  defaultGraceDays: integer('default_grace_days').notNull().default(0),
  defaultCurrency: text('default_currency').notNull().default('usd'),
  aiCreditRateCents: integer('ai_credit_rate_cents').notNull().default(100),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type PlatformSettings = typeof platformSettings.$inferSelect
export type NewPlatformSettings = typeof platformSettings.$inferInsert
