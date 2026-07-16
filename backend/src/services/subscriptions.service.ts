import { eq, and, desc } from 'drizzle-orm'
import Stripe from 'stripe'
import { db } from '../db/client'
import { subscriptions, payments, plans, tenants, coupons } from '../models'
import { getOrCreateCustomer, createCheckoutSession, createStripeCoupon, cancelStripeSubscription } from './stripe.service'
import { redeemCoupon } from './coupons.service'
import { computeDiscountCents, cyclesFromDuration } from '../utils/coupon'
import { handleCreditPurchaseCheckoutCompleted } from './credit-purchases.service'

type Executor = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * If the tenant's latest subscription is still riding out a repeating/forever
 * discount and no new code was supplied, carry the same coupon forward onto
 * this new (renewal) subscription row rather than requiring the code to be
 * re-entered. Re-checks the coupon is still active/unexpired — a since-
 * deactivated coupon stops applying automatically. This does NOT insert a new
 * coupon_redemptions row: usage limits count original redemptions, not how
 * many cycles a redemption's discount went on to cover.
 */
async function carryForwardDiscount(tx: Executor, tenantId: number, grossAmountCents: number) {
  const [latest] = await tx
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1)

  if (!latest?.couponId || !(latest.discountCyclesRemaining === null || latest.discountCyclesRemaining > 0)) {
    return null
  }

  const [coupon] = await tx.select().from(coupons).where(eq(coupons.id, latest.couponId)).limit(1)
  const now = new Date()
  if (!coupon || !coupon.active || (coupon.endAt && now > coupon.endAt)) return null

  return {
    couponId: coupon.id,
    discountAmountCents: computeDiscountCents(grossAmountCents, coupon),
    discountCyclesRemaining: latest.discountCyclesRemaining === null ? null : latest.discountCyclesRemaining - 1,
  }
}

export async function assignOfflineSubscription(params: {
  tenantId: number
  planId: number
  amountCents: number
  paidThroughDate: string
  note?: string | null
  couponCode?: string
}) {
  return db.transaction(async (tx) => {
    const [plan] = await tx.select().from(plans).where(eq(plans.id, params.planId)).limit(1)
    if (!plan) throw new Error('Plan not found')

    let discount: { couponId: number; discountAmountCents: number; discountCyclesRemaining: number | null } | null = null

    if (params.couponCode) {
      const result = await redeemCoupon(tx, params.couponCode, {
        appliesTo: 'purchase',
        tenantId: params.tenantId,
        grossAmountCents: plan.priceMonthlyCents,
      })
      const cycles = cyclesFromDuration(result.coupon.durationType, result.coupon.durationInMonths)
      discount = {
        couponId: result.coupon.id,
        discountAmountCents: result.discountCents,
        discountCyclesRemaining: cycles === null ? null : cycles - 1,
      }
    } else {
      discount = await carryForwardDiscount(tx, params.tenantId, plan.priceMonthlyCents)
    }

    const [subscription] = await tx
      .insert(subscriptions)
      .values({
        tenantId: params.tenantId,
        planId: params.planId,
        billingType: 'offline',
        status: 'active',
        currentPeriodEnd: new Date(params.paidThroughDate),
        offlineNote: params.note ?? null,
        couponId: discount?.couponId ?? null,
        discountAmountCents: discount?.discountAmountCents ?? null,
        discountCyclesRemaining: discount?.discountCyclesRemaining ?? null,
      })
      .returning()

    await tx.insert(payments).values({
      subscriptionId: subscription.id,
      amountCents: params.amountCents,
      method: 'offline',
      status: 'succeeded',
      note: params.note ?? null,
    })

    await tx
      .update(tenants)
      .set({ aiCreditsBalance: plan.aiCredits, updatedAt: new Date() })
      .where(eq(tenants.id, params.tenantId))

    return subscription
  })
}

export async function createOnlineCheckoutSession(params: {
  tenantId: number
  planId: number
  adminEmail: string
  adminUrl: string
  couponCode?: string
}) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, params.tenantId)).limit(1)
  const [plan] = await db.select().from(plans).where(eq(plans.id, params.planId)).limit(1)
  if (!tenant) throw new Error('Tenant not found')
  if (!plan) throw new Error('Plan not found')
  if (!plan.stripePriceId) throw new Error('Plan is not configured for online billing')

  const customerId = await getOrCreateCustomer(tenant.name, params.adminEmail)

  const { subscription, coupon } = await db.transaction(async (tx) => {
    let couponResult: Awaited<ReturnType<typeof redeemCoupon>> | null = null
    if (params.couponCode) {
      couponResult = await redeemCoupon(tx, params.couponCode, {
        appliesTo: 'purchase',
        tenantId: params.tenantId,
        grossAmountCents: plan.priceMonthlyCents,
      })
    }
    const cycles = couponResult ? cyclesFromDuration(couponResult.coupon.durationType, couponResult.coupon.durationInMonths) : null

    const [subscription] = await tx
      .insert(subscriptions)
      .values({
        tenantId: params.tenantId,
        planId: params.planId,
        billingType: 'online',
        status: 'trialing',
        stripeCustomerId: customerId,
        couponId: couponResult?.coupon.id ?? null,
        discountAmountCents: couponResult?.discountCents ?? null,
        discountCyclesRemaining: couponResult ? (cycles === null ? null : cycles - 1) : null,
      })
      .returning()

    return { subscription, coupon: couponResult?.coupon ?? null }
  })

  let stripeCouponId: string | null = null
  if (coupon && subscription.discountAmountCents != null) {
    stripeCouponId = await createStripeCoupon({
      discountAmountCents: subscription.discountAmountCents,
      durationType: coupon.durationType,
      durationInMonths: coupon.durationInMonths,
    })
    await db.update(coupons).set({ stripeCouponId }).where(eq(coupons.id, coupon.id))
  }

  const session = await createCheckoutSession({
    customerId,
    lineItem: { priceId: plan.stripePriceId },
    successUrl: `${params.adminUrl}/superadmin/plans?checkout=success&tenantId=${params.tenantId}&subscriptionId=${subscription.id}`,
    cancelUrl: `${params.adminUrl}/superadmin/plans?checkout=cancelled`,
    metadata: { subscriptionId: String(subscription.id) },
    discounts: stripeCouponId ? [{ coupon: stripeCouponId }] : undefined,
  })

  return { checkoutUrl: session.url, subscriptionId: subscription.id }
}

export async function getSubscriptionById(tenantId: number, subscriptionId: number) {
  const [row] = await db
    .select({
      id: subscriptions.id,
      status: subscriptions.status,
      billingType: subscriptions.billingType,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      discountAmountCents: subscriptions.discountAmountCents,
      createdAt: subscriptions.createdAt,
      planName: plans.name,
      priceMonthlyCents: plans.priceMonthlyCents,
      couponCode: coupons.code,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .leftJoin(coupons, eq(subscriptions.couponId, coupons.id))
    .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.tenantId, tenantId)))
    .limit(1)

  return row ?? null
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

      const creditPurchaseId = Number(session.metadata?.creditPurchaseId)
      if (creditPurchaseId) {
        await handleCreditPurchaseCheckoutCompleted(creditPurchaseId)
        break
      }

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
