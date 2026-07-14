import { Router, Response } from 'express'
import { z } from 'zod'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import { assignOfflineSubscription, createOnlineCheckoutSession, cancelSubscription } from '../services/subscriptions.service'
import { getTenantAdminEmail } from '../services/tenants.service'

const router = Router({ mergeParams: true })

const offlineSchema = z.object({
  planId: z.number().int(),
  amountCents: z.number().int().min(0),
  paidThroughDate: z.string(),
  note: z.string().nullable().optional(),
})

const checkoutSchema = z.object({
  planId: z.number().int(),
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
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
      })
      res.json(result)
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create checkout session' })
    }
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
