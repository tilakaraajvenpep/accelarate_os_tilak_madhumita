import { Router, Request, Response } from 'express'
import { constructWebhookEvent } from '../services/stripe.service'
import { handleStripeWebhookEvent } from '../services/subscriptions.service'

const router = Router()

router.post('/', async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature']
  if (typeof signature !== 'string') {
    res.status(400).json({ error: 'Missing stripe-signature header' })
    return
  }
  try {
    const event = constructWebhookEvent(req.body as Buffer, signature)
    await handleStripeWebhookEvent(event)
    res.json({ received: true })
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Webhook error' })
  }
})

export default router
