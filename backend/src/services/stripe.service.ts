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
  priceId: string
  successUrl: string
  cancelUrl: string
  metadata: Record<string, string>
}) {
  const stripe = getClient()
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: params.customerId,
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: params.metadata,
    subscription_data: { metadata: params.metadata },
  })
  return session
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
