import Stripe from 'stripe'

let client: Stripe | null = null

function getClient(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
    client = new Stripe(key)
  }
  return client
}

export async function createProductAndPrice(planName: string, priceMonthlyCents: number) {
  const stripe = getClient()
  const product = await stripe.products.create({ name: planName })
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: priceMonthlyCents,
    currency: 'usd',
    recurring: { interval: 'month' },
  })
  return price.id
}

export async function getOrCreateCustomer(tenantName: string, email: string, existingCustomerId?: string | null) {
  const stripe = getClient()
  if (existingCustomerId) return existingCustomerId
  const customer = await stripe.customers.create({ name: tenantName, email })
  return customer.id
}

export async function createCheckoutSession(params: {
  customerId: string
  lineItem: { priceId: string } | { amountCents: number; productName: string }
  successUrl: string
  cancelUrl: string
  metadata: Record<string, string>
  mode?: 'subscription' | 'payment'
  discounts?: { coupon: string }[]
}) {
  const stripe = getClient()
  const mode = params.mode ?? 'subscription'
  const lineItem: Stripe.Checkout.SessionCreateParams.LineItem =
    'priceId' in params.lineItem
      ? { price: params.lineItem.priceId, quantity: 1 }
      : {
          price_data: {
            currency: 'usd',
            product_data: { name: params.lineItem.productName },
            unit_amount: params.lineItem.amountCents,
            ...(mode === 'subscription' ? { recurring: { interval: 'month' } } : {}),
          },
          quantity: 1,
        }
  const session = await stripe.checkout.sessions.create({
    mode,
    customer: params.customerId,
    line_items: [lineItem],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: params.metadata,
    discounts: params.discounts,
    ...(mode === 'subscription' ? { subscription_data: { metadata: params.metadata } } : {}),
  })
  return session
}

/**
 * Creates a one-off Stripe Coupon object mirroring one of our own DB coupon
 * records, purely as the mechanism that lets Stripe auto-revert the price
 * after the discount period ends — admins never see or manage this directly.
 *
 * Always uses amount_off (the exact cents figure we already computed via
 * computeDiscountCents, respecting any percentage max-discount cap) rather
 * than percent_off — Stripe has no native "percent off up to $X" concept, so
 * replicating our cap through Stripe's own percent math would require extra
 * logic. Since the underlying plan/recharge price is fixed, a flat amount_off
 * behaves identically to the equivalent percentage on every recurring cycle.
 */
export async function createStripeCoupon(params: {
  discountAmountCents: number
  durationType: 'once' | 'repeating' | 'forever'
  durationInMonths?: number | null
}) {
  const stripe = getClient()
  const coupon = await stripe.coupons.create({
    amount_off: params.discountAmountCents,
    currency: 'usd',
    duration: params.durationType,
    duration_in_months: params.durationType === 'repeating' ? (params.durationInMonths ?? undefined) : undefined,
  })
  return coupon.id
}

export async function cancelStripeSubscription(stripeSubscriptionId: string) {
  const stripe = getClient()
  await stripe.subscriptions.cancel(stripeSubscriptionId)
}

export function constructWebhookEvent(rawBody: Buffer, signature: string) {
  const stripe = getClient()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET is not set')
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
}
