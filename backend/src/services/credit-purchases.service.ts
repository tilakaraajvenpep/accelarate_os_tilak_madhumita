import { eq, and, sql } from 'drizzle-orm'
import { db } from '../db/client'
import { creditPurchases, tenants, coupons } from '../models'
import { getPlatformSettings } from './platform-settings.service'
import { getOrCreateCustomer, createCheckoutSession, createStripeCoupon } from './stripe.service'
import { redeemCoupon } from './coupons.service'

export async function recordOfflineRecharge(params: {
  tenantId: number
  credits: number
  amountCentsReceived: number
  note?: string | null
  couponCode?: string
}) {
  return db.transaction(async (tx) => {
    const settings = await getPlatformSettings()
    const grossAmountCents = params.credits * settings.aiCreditRateCents

    let discountAmountCents = 0
    let couponId: number | null = null
    if (params.couponCode) {
      const result = await redeemCoupon(tx, params.couponCode, {
        appliesTo: 'recharge',
        tenantId: params.tenantId,
        grossAmountCents,
      })
      discountAmountCents = result.discountCents
      couponId = result.coupon.id
    }

    const [purchase] = await tx
      .insert(creditPurchases)
      .values({
        tenantId: params.tenantId,
        credits: params.credits,
        rateCentsSnapshot: settings.aiCreditRateCents,
        grossAmountCents,
        discountAmountCents,
        netAmountCents: params.amountCentsReceived,
        couponId,
        method: 'offline',
        status: 'succeeded',
        note: params.note ?? null,
      })
      .returning()

    await tx
      .update(tenants)
      .set({ aiCreditsBalance: sql`${tenants.aiCreditsBalance} + ${params.credits}`, updatedAt: new Date() })
      .where(eq(tenants.id, params.tenantId))

    return purchase
  })
}

export async function createRechargeCheckoutSession(params: {
  tenantId: number
  credits: number
  adminEmail: string
  successUrl: string
  cancelUrl: string
  couponCode?: string
}) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, params.tenantId)).limit(1)
  if (!tenant) throw new Error('Tenant not found')

  const settings = await getPlatformSettings()
  const grossAmountCents = params.credits * settings.aiCreditRateCents
  const customerId = await getOrCreateCustomer(tenant.name, params.adminEmail)

  const { purchase, coupon } = await db.transaction(async (tx) => {
    let couponResult: Awaited<ReturnType<typeof redeemCoupon>> | null = null
    if (params.couponCode) {
      couponResult = await redeemCoupon(tx, params.couponCode, {
        appliesTo: 'recharge',
        tenantId: params.tenantId,
        grossAmountCents,
      })
    }
    const discountAmountCents = couponResult?.discountCents ?? 0

    const [purchase] = await tx
      .insert(creditPurchases)
      .values({
        tenantId: params.tenantId,
        credits: params.credits,
        rateCentsSnapshot: settings.aiCreditRateCents,
        grossAmountCents,
        discountAmountCents,
        netAmountCents: grossAmountCents - discountAmountCents,
        couponId: couponResult?.coupon.id ?? null,
        method: 'stripe',
        status: 'pending',
        stripeCustomerId: customerId,
      })
      .returning()

    return { purchase, coupon: couponResult?.coupon ?? null }
  })

  let stripeCouponId: string | null = null
  if (coupon) {
    // Recharges are always one-off — 'once' regardless of the coupon's
    // durationType (which is only meaningful for purchase/subscription coupons).
    stripeCouponId = await createStripeCoupon({ discountAmountCents: purchase.discountAmountCents, durationType: 'once' })
    await db.update(coupons).set({ stripeCouponId }).where(eq(coupons.id, coupon.id))
  }

  const successUrlWithId = `${params.successUrl}${params.successUrl.includes('?') ? '&' : '?'}creditPurchaseId=${purchase.id}`

  const session = await createCheckoutSession({
    customerId,
    lineItem: { amountCents: purchase.netAmountCents, productName: `${params.credits} AI Credits` },
    mode: 'payment',
    successUrl: successUrlWithId,
    cancelUrl: params.cancelUrl,
    metadata: { creditPurchaseId: String(purchase.id) },
    discounts: stripeCouponId ? [{ coupon: stripeCouponId }] : undefined,
  })

  await db
    .update(creditPurchases)
    .set({ stripeCheckoutSessionId: session.id })
    .where(eq(creditPurchases.id, purchase.id))

  return { checkoutUrl: session.url, creditPurchaseId: purchase.id }
}

export async function getCreditPurchaseById(tenantId: number, id: number) {
  const [row] = await db
    .select({
      id: creditPurchases.id,
      credits: creditPurchases.credits,
      grossAmountCents: creditPurchases.grossAmountCents,
      discountAmountCents: creditPurchases.discountAmountCents,
      netAmountCents: creditPurchases.netAmountCents,
      method: creditPurchases.method,
      status: creditPurchases.status,
      paidAt: creditPurchases.paidAt,
      couponCode: coupons.code,
    })
    .from(creditPurchases)
    .leftJoin(coupons, eq(creditPurchases.couponId, coupons.id))
    .where(and(eq(creditPurchases.id, id), eq(creditPurchases.tenantId, tenantId)))
    .limit(1)

  return row ?? null
}

export async function handleCreditPurchaseCheckoutCompleted(creditPurchaseId: number) {
  const [purchase] = await db.select().from(creditPurchases).where(eq(creditPurchases.id, creditPurchaseId)).limit(1)
  if (!purchase || purchase.status === 'succeeded') return

  await db.transaction(async (tx) => {
    await tx.update(creditPurchases).set({ status: 'succeeded', updatedAt: new Date() }).where(eq(creditPurchases.id, creditPurchaseId))
    await tx
      .update(tenants)
      .set({ aiCreditsBalance: sql`${tenants.aiCreditsBalance} + ${purchase.credits}`, updatedAt: new Date() })
      .where(eq(tenants.id, purchase.tenantId))
  })
}
