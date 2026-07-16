import { Router, Response } from 'express'
import { z } from 'zod'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import { recordOfflineRecharge, createRechargeCheckoutSession, getCreditPurchaseById } from '../services/credit-purchases.service'
import { getTenantSlugById } from '../services/tenants.service'
import { tenantUrl } from '../utils/host'

const router = Router()

const offlineSchema = z.object({
  credits: z.number().int().positive(),
  amountCentsReceived: z.number().int().min(0),
  note: z.string().nullable().optional(),
  couponCode: z.string().optional(),
})

const checkoutSchema = z.object({
  credits: z.number().int().positive(),
  couponCode: z.string().optional(),
})

router.post(
  '/tenants/:tenantId/recharges/offline',
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
      const purchase = await recordOfflineRecharge({ tenantId, ...parsed.data })
      res.json(purchase)
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to record offline recharge' })
    }
  },
)

router.post(
  '/tenants/me/recharges/checkout',
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
      const slug = await getTenantSlugById(tenantId)
      const returnBase = slug ? tenantUrl(slug, baseDomain) : baseDomain
      const result = await createRechargeCheckoutSession({
        tenantId,
        credits: parsed.data.credits,
        couponCode: parsed.data.couponCode,
        adminEmail: req.dbUser!.email,
        successUrl: `${returnBase}/?recharge=success`,
        cancelUrl: `${returnBase}/?recharge=cancelled`,
      })
      res.json(result)
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create recharge checkout session' })
    }
  },
)

router.get(
  '/tenants/me/recharges/:id',
  requireAuth,
  loadUser,
  requireRole('admin'),
  async (req: AuthRequest, res: Response) => {
    const tenantId = req.dbUser!.tenantId
    if (!tenantId) {
      res.status(400).json({ error: 'No tenant associated with this account' })
      return
    }
    const purchase = await getCreditPurchaseById(tenantId, Number(req.params.id))
    if (!purchase) {
      res.status(404).json({ error: 'Credit purchase not found' })
      return
    }
    res.json(purchase)
  },
)

export default router
