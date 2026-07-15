import { eq } from 'drizzle-orm'
import Stripe from 'stripe'
import { db } from '../db/client'
import { subscriptions, payments, plans, tenants } from '../models'
import { getOrCreateCustomer, createCheckoutSession, cancelStripeSubscription } from './stripe.service'

export async function assignOfflineSubscription(params: {
  tenantId: number
  planId: number
  amountCents: number
  paidThroughDate: string
  note?: string | null
}) {
  const [subscription] = await db
    .insert(subscriptions)
    .values({
      tenantId: params.tenantId,
      planId: params.planId,
      billingType: 'offline',
      status: 'active',
      currentPeriodEnd: new Date(params.paidThroughDate),
      offlineNote: params.note ?? null,
    })
    .returning()

  await db.insert(payments).values({
    subscriptionId: subscription.id,
    amountCents: params.amountCents,
    method: 'offline',
    status: 'succeeded',
    note: params.note ?? null,
  })

  const [plan] = await db.select().from(plans).where(eq(plans.id, params.planId)).limit(1)
  if (plan) {
    await db
      .update(tenants)
      .set({ aiCreditsBalance: plan.aiCredits, updatedAt: new Date() })
      .where(eq(tenants.id, params.tenantId))
  }

  return subscription
}

export async function createOnlineCheckoutSession(params: {
  tenantId: number
  planId: number
  adminEmail: string
  frontendUrl: string
}) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, params.tenantId)).limit(1)
  const [plan] = await db.select().from(plans).where(eq(plans.id, params.planId)).limit(1)
  if (!tenant) throw new Error('Tenant not found')
  if (!plan) throw new Error('Plan not found')
  if (!plan.stripePriceId) throw new Error('Plan is not configured for online billing')

  const customerId = await getOrCreateCustomer(tenant.name, params.adminEmail)

  const [subscription] = await db
    .insert(subscriptions)
    .values({
      tenantId: params.tenantId,
      planId: params.planId,
      billingType: 'online',
      status: 'trialing',
      stripeCustomerId: customerId,
    })
    .returning()

  const session = await createCheckoutSession({
    customerId,
    priceId: plan.stripePriceId,
    successUrl: `${params.frontendUrl}/app/superadmin/plans?checkout=success`,
    cancelUrl: `${params.frontendUrl}/app/superadmin/plans?checkout=cancelled`,
    metadata: { subscriptionId: String(subscription.id) },
  })

  return { checkoutUrl: session.url, subscriptionId: subscription.id }
}

export async function cancelSubscription(tenantId: number, subscriptionId: number) {
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId))
    .limit(1)
  if (!subscription || subscription.tenantId !== tenantId) throw new Error('Subscription not found')

  if (subscription.billingType === 'online' && subscription.stripeSubscriptionId) {
    try {
      await cancelStripeSubscription(subscription.stripeSubscriptionId)
    } catch (err: unknown) {
      // Already canceled on Stripe's side (e.g. resource_missing) shouldn't block us
      // from reflecting cancellation locally — anything else should surface.
      if (!(err instanceof Stripe.errors.StripeError && err.code === 'resource_missing')) throw err
    }
  }

  const [updated] = await db
    .update(subscriptions)
    .set({ status: 'canceled', updatedAt: new Date() })
    .where(eq(subscriptions.id, subscriptionId))
    .returning()
  return updated
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | undefined {
  const sub = invoice.parent?.subscription_details?.subscription
  return typeof sub === 'string' ? sub : sub?.id
}

async function findSubscriptionByStripeId(stripeSubscriptionId: string) {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1)
  return sub ?? null
}

export async function handleStripeWebhookEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const subscriptionId = Number(session.metadata?.subscriptionId)
      if (!subscriptionId) break
      const stripeSubscriptionId =
        typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
      const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId)).limit(1)
      await db
        .update(subscriptions)
        .set({ status: 'active', stripeSubscriptionId, updatedAt: new Date() })
        .where(eq(subscriptions.id, subscriptionId))
      if (sub) {
        const [plan] = await db.select().from(plans).where(eq(plans.id, sub.planId)).limit(1)
        if (plan) {
          await db
            .update(tenants)
            .set({ aiCreditsBalance: plan.aiCredits, updatedAt: new Date() })
            .where(eq(tenants.id, sub.tenantId))
        }
      }
      if (session.amount_total) {
        await db.insert(payments).values({
          subscriptionId,
          amountCents: session.amount_total,
          method: 'stripe',
          status: 'succeeded',
          stripeInvoiceId: typeof session.invoice === 'string' ? session.invoice : session.invoice?.id,
        })
      }
      break
    }
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice
      const stripeSubscriptionId = getInvoiceSubscriptionId(invoice)
      if (!stripeSubscriptionId) break
      const sub = await findSubscriptionByStripeId(stripeSubscriptionId)
      if (!sub) break
      const periodEnd = invoice.lines.data[0]?.period?.end
      await db
        .update(subscriptions)
        .set({
          status: 'active',
          currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : sub.currentPeriodEnd,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, sub.id))
      await db.insert(payments).values({
        subscriptionId: sub.id,
        amountCents: invoice.amount_paid,
        method: 'stripe',
        status: 'succeeded',
        stripeInvoiceId: invoice.id,
      })
      break
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const stripeSubscriptionId = getInvoiceSubscriptionId(invoice)
      if (!stripeSubscriptionId) break
      const sub = await findSubscriptionByStripeId(stripeSubscriptionId)
      if (!sub) break
      await db
        .update(subscriptions)
        .set({ status: 'past_due', updatedAt: new Date() })
        .where(eq(subscriptions.id, sub.id))
      break
    }
    case 'customer.subscription.deleted': {
      const stripeSubscription = event.data.object as Stripe.Subscription
      const sub = await findSubscriptionByStripeId(stripeSubscription.id)
      if (!sub) break
      await db
        .update(subscriptions)
        .set({ status: 'canceled', updatedAt: new Date() })
        .where(eq(subscriptions.id, sub.id))
      break
    }
  }
}
