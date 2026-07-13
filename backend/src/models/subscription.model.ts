import { pgTable, serial, text, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'
import { plans } from './plan.model'

export const billingTypeEnum = pgEnum('billing_type', ['online', 'offline'])

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'trialing',
  'active',
  'past_due',
  'canceled',
  'expired',
])

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id')
    .notNull()
    .references(() => tenants.id),
  planId: integer('plan_id')
    .notNull()
    .references(() => plans.id),
  billingType: billingTypeEnum('billing_type').notNull(),
  status: subscriptionStatusEnum('status').notNull().default('trialing'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  currentPeriodEnd: timestamp('current_period_end'),
  offlineNote: text('offline_note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Subscription = typeof subscriptions.$inferSelect
export type NewSubscription = typeof subscriptions.$inferInsert
