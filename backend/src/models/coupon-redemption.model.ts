import { pgTable, serial, integer, timestamp } from 'drizzle-orm/pg-core'
import { coupons, couponAppliesToEnum } from './coupon.model'
import { tenants } from './tenant.model'
import { subscriptions } from './subscription.model'
import { creditPurchases } from './credit-purchase.model'

export const couponRedemptions = pgTable('coupon_redemptions', {
  id: serial('id').primaryKey(),
  couponId: integer('coupon_id')
    .notNull()
    .references(() => coupons.id),
  tenantId: integer('tenant_id')
    .notNull()
    .references(() => tenants.id),
  appliesTo: couponAppliesToEnum('applies_to').notNull(),
  discountAmountCents: integer('discount_amount_cents').notNull(),
  subscriptionId: integer('subscription_id').references(() => subscriptions.id),
  creditPurchaseId: integer('credit_purchase_id').references(() => creditPurchases.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type CouponRedemption = typeof couponRedemptions.$inferSelect
export type NewCouponRedemption = typeof couponRedemptions.$inferInsert
