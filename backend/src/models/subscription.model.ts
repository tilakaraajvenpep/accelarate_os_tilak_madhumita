import { pgTable, serial, text, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'
import { plans } from './plan.model'
import { coupons } from './coupon.model'

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
  // Snapshotted at redemption time so later coupon edits never retroactively
  // change an already-applied discount.
  couponId: integer('coupon_id').references(() => coupons.id),
  discountAmountCents: integer('discount_amount_cents'),
  // null = forever/unlimited, positive = cycles left, 0 = exhausted.
  discountCyclesRemaining: integer('discount_cycles_remaining'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Subscription = typeof subscriptions.$inferSelect
export type NewSubscription = typeof subscriptions.$inferInsert
