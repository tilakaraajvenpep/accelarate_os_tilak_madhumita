import { pgTable, serial, text, integer, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core'

export const couponDiscountTypeEnum = pgEnum('coupon_discount_type', ['percentage', 'fixed_amount'])

export const couponAppliesToEnum = pgEnum('coupon_applies_to', ['purchase', 'recharge'])

export const couponDurationTypeEnum = pgEnum('coupon_duration_type', ['once', 'repeating', 'forever'])

export const coupons = pgTable('coupons', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  discountType: couponDiscountTypeEnum('discount_type').notNull(),
  // Percent (1-100) when discountType='percentage', cents when 'fixed_amount'.
  discountValue: integer('discount_value').notNull(),
  maxDiscountCents: integer('max_discount_cents'),
  appliesTo: couponAppliesToEnum('applies_to').notNull(),
  minPurchaseAmountCents: integer('min_purchase_amount_cents'),
  perCustomerLimit: integer('per_customer_limit'),
  totalUsageLimit: integer('total_usage_limit'),
  startAt: timestamp('start_at'),
  endAt: timestamp('end_at'),
  active: boolean('active').notNull().default(true),
  // Only meaningful when appliesTo='purchase' — recharges are always one-off.
  durationType: couponDurationTypeEnum('duration_type').notNull().default('once'),
  durationInMonths: integer('duration_in_months'),
  // Set only when redeemed for an online payment — the hidden Stripe-side
  // object that makes Stripe auto-revert the price after the discount ends.
  stripeCouponId: text('stripe_coupon_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Coupon = typeof coupons.$inferSelect
export type NewCoupon = typeof coupons.$inferInsert
