import { Router, Response } from 'express'
import { z } from 'zod'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import { assignOfflineSubscription, createOnlineCheckoutSession, cancelSubscription, getSubscriptionById } from '../services/subscriptions.service'
import { getTenantAdminEmail } from '../services/tenants.service'

const router = Router({ mergeParams: true })

const offlineSchema = z.object({
  planId: z.number().int(),
  amountCents: z.number().int().min(0),
  paidThroughDate: z.string(),
  note: z.string().nullable().optional(),
  couponCode: z.string().optional(),
})

const checkoutSchema = z.object({
  planId: z.number().int(),
  couponCode: z.string().optional(),
})

router.post(
  '/offline',
  requireAuth,
  loadUser,
  requireRole('super_admin'),
  async (req: AuthRequest, res: Response) => {
    const tenantId = Number(req.params.tenantId)
    const parsed = offlineSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }
    try {
      const subscription = await assignOfflineSubscription({ tenantId, ...parsed.data })
      res.json(subscription)
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to assign offline subscription' })
    }
  },
)

router.post(
  '/checkout',
  requireAuth,
  loadUser,
  requireRole('super_admin'),
  async (req: AuthRequest, res: Response) => {
    const tenantId = Number(req.params.tenantId)
    const parsed = checkoutSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }
    try {
      const adminEmail = (await getTenantAdminEmail(tenantId)) ?? req.dbUser!.email
      const result = await createOnlineCheckoutSession({
        tenantId,
        planId: parsed.data.planId,
        adminEmail,
        adminUrl: process.env.ADMIN_URL || 'http://admin.localhost:5173',
        couponCode: parsed.data.couponCode,
      })
      res.json(result)
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create checkout session' })
    }
  },
)

router.get(
  '/:id',
  requireAuth,
  loadUser,
  requireRole('super_admin'),
  async (req: AuthRequest, res: Response) => {
    const tenantId = Number(req.params.tenantId)
    const subscriptionId = Number(req.params.id)
    const subscription = await getSubscriptionById(tenantId, subscriptionId)
    if (!subscription) {
      res.status(404).json({ error: 'Subscription not found' })
      return
    }
    res.json(subscription)
  },
)

router.delete(
  '/:id',
  requireAuth,
  loadUser,
  requireRole('super_admin'),
  async (req: AuthRequest, res: Response) => {
    const tenantId = Number(req.params.tenantId)
    const subscriptionId = Number(req.params.id)
    try {
      const subscription = await cancelSubscription(tenantId, subscriptionId)
      res.json(subscription)
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to cancel subscription' })
    }
  },
)

export default router
