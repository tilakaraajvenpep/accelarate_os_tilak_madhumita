import { pgTable, serial, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core'

export const plans = pgTable('plans', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  cohortsLimit: integer('cohorts_limit'),
  foundersLimit: integer('founders_limit'),
  storageLimitGb: integer('storage_limit_gb'),
  priceMonthlyCents: integer('price_monthly_cents').notNull().default(0),
  isCustom: boolean('is_custom').notNull().default(false),
  active: boolean('active').notNull().default(true),
  stripePriceId: text('stripe_price_id'),
  aiCredits: integer('ai_credits').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Plan = typeof plans.$inferSelect
export type NewPlan = typeof plans.$inferInsert
