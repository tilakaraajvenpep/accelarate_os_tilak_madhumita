import { pgTable, serial, text, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core'
import { subscriptions } from './subscription.model'

export const paymentMethodEnum = pgEnum('payment_method', ['stripe', 'offline'])

export const paymentStatusEnum = pgEnum('payment_status', ['succeeded', 'pending', 'failed'])

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  subscriptionId: integer('subscription_id')
    .notNull()
    .references(() => subscriptions.id),
  amountCents: integer('amount_cents').notNull(),
  currency: text('currency').notNull().default('usd'),
  method: paymentMethodEnum('method').notNull(),
  status: paymentStatusEnum('status').notNull().default('succeeded'),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  stripeInvoiceId: text('stripe_invoice_id'),
  paidAt: timestamp('paid_at').defaultNow().notNull(),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type Payment = typeof payments.$inferSelect
export type NewPayment = typeof payments.$inferInsert
