import { Router, Response } from 'express'
import { z } from 'zod'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import { createOnlineCheckoutSession, getSubscriptionById } from '../services/subscriptions.service'
import { apexUrl } from '../utils/host'

const router = Router()

const checkoutSchema = z.object({
  planId: z.number().int(),
  couponCode: z.string().optional(),
})

/**
 * Self-serve plan checkout used by the signup wizard's payment step — a
 * freshly-registered tenant admin paying for their own tenant, as opposed to
 * the super-admin-only /api/tenants/:tenantId/subscriptions/checkout used to
 * assign a plan on a tenant's behalf.
 */
router.post(
  '/tenants/me/subscriptions/checkout',
  requireAuth,
  loadUser,
  requireRole('admin'),
  async (req: AuthRequest, res: Response) => {
    const tenantId = req.dbUser!.tenantId
    if (!tenantId) {
      res.status(400).json({ error: 'No tenant associated with this account' })
      return
    }
    const parsed = checkoutSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }
    try {
      const baseDomain = process.env.BASE_DOMAIN || 'localhost'
      const origin = apexUrl(baseDomain)
      const result = await createOnlineCheckoutSession({
        tenantId,
        planId: parsed.data.planId,
        adminEmail: req.dbUser!.email,
        successUrl: `${origin}/get-started?step=payment&checkout=success`,
        cancelUrl: `${origin}/get-started?step=payment&checkout=cancelled`,
        couponCode: parsed.data.couponCode,
      })
      res.json(result)
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create checkout session' })
    }
  },
)

router.get(
  '/tenants/me/subscriptions/:id',
  requireAuth,
  loadUser,
  requireRole('admin'),
  async (req: AuthRequest, res: Response) => {
    const tenantId = req.dbUser!.tenantId
    if (!tenantId) {
      res.status(400).json({ error: 'No tenant associated with this account' })
      return
    }
    const subscription = await getSubscriptionById(tenantId, Number(req.params.id))
    if (!subscription) {
      res.status(404).json({ error: 'Subscription not found' })
      return
    }
    res.json(subscription)
  },
)

export default router
