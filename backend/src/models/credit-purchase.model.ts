import { pgTable, serial, integer, text, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'
import { coupons } from './coupon.model'

export const creditPurchaseMethodEnum = pgEnum('credit_purchase_method', ['stripe', 'offline'])

export const creditPurchaseStatusEnum = pgEnum('credit_purchase_status', ['succeeded', 'pending', 'failed'])

export const creditPurchases = pgTable('credit_purchases', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id')
    .notNull()
    .references(() => tenants.id),
  credits: integer('credits').notNull(),
  rateCentsSnapshot: integer('rate_cents_snapshot').notNull(),
  grossAmountCents: integer('gross_amount_cents').notNull(),
  discountAmountCents: integer('discount_amount_cents').notNull().default(0),
  netAmountCents: integer('net_amount_cents').notNull(),
  couponId: integer('coupon_id').references(() => coupons.id),
  method: creditPurchaseMethodEnum('method').notNull(),
  status: creditPurchaseStatusEnum('status').notNull().default('succeeded'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeCheckoutSessionId: text('stripe_checkout_session_id'),
  note: text('note'),
  paidAt: timestamp('paid_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type CreditPurchase = typeof creditPurchases.$inferSelect
export type NewCreditPurchase = typeof creditPurchases.$inferInsert
