import { Router, Response } from 'express'
import { z } from 'zod'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import { listCoupons, createCoupon, updateCoupon, deleteCoupon, validateCouponForRedemption } from '../services/coupons.service'

const router = Router()

const durationTypeEnum = z.enum(['once', 'repeating', 'forever'])

const couponSchema = z.object({
  code: z.string().min(1),
  discountType: z.enum(['percentage', 'fixed_amount']),
  discountValue: z.number().int().positive(),
  maxDiscountCents: z.number().int().positive().nullable().optional(),
  appliesTo: z.enum(['purchase', 'recharge']),
  minPurchaseAmountCents: z.number().int().positive().nullable().optional(),
  perCustomerLimit: z.number().int().positive().nullable().optional(),
  totalUsageLimit: z.number().int().positive().nullable().optional(),
  startAt: z.string().datetime().nullable().optional(),
  endAt: z.string().datetime().nullable().optional(),
  durationType: durationTypeEnum.optional(),
  durationInMonths: z.number().int().positive().nullable().optional(),
})

const updateCouponSchema = couponSchema.partial().extend({
  active: z.boolean().optional(),
})

const validateSchema = z.object({
  code: z.string().min(1),
  appliesTo: z.enum(['purchase', 'recharge']),
  grossAmountCents: z.number().int().min(0),
})

function toDateOrNull(value?: string | null) {
  return value ? new Date(value) : value === null ? null : undefined
}

router.get('/', requireAuth, loadUser, requireRole('super_admin'), async (_req: AuthRequest, res: Response) => {
  const coupons = await listCoupons()
  res.json(coupons)
})

router.post('/', requireAuth, loadUser, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const parsed = couponSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const coupon = await createCoupon({
      ...parsed.data,
      startAt: toDateOrNull(parsed.data.startAt),
      endAt: toDateOrNull(parsed.data.endAt),
    })
    res.json(coupon)
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create coupon' })
  }
})

router.patch('/:id', requireAuth, loadUser, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id)
  const parsed = updateCouponSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const coupon = await updateCoupon(id, {
      ...parsed.data,
      startAt: toDateOrNull(parsed.data.startAt),
      endAt: toDateOrNull(parsed.data.endAt),
    })
    if (!coupon) {
      res.status(404).json({ error: 'Coupon not found' })
      return
    }
    res.json(coupon)
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update coupon' })
  }
})

router.delete('/:id', requireAuth, loadUser, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id)
  try {
    await deleteCoupon(id)
    res.json({ message: 'Coupon deleted' })
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to delete coupon' })
  }
})

router.post('/validate', requireAuth, loadUser, requireRole('super_admin', 'admin'), async (req: AuthRequest, res: Response) => {
  const parsed = validateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  const tenantId = req.dbUser!.tenantId
  if (!tenantId && req.dbUser!.role !== 'super_admin') {
    res.status(400).json({ error: 'No tenant associated with this account' })
    return
  }
  try {
    const result = await validateCouponForRedemption(parsed.data.code, {
      appliesTo: parsed.data.appliesTo,
      // Super-admins validating on behalf of a tenant (e.g. assigning a plan)
      // don't have their own tenantId — per-customer limits are checked for
      // real at redemption time against the actual target tenant instead.
      tenantId: tenantId ?? 0,
      grossAmountCents: parsed.data.grossAmountCents,
    })
    res.json({
      valid: true,
      discountCents: result.discountCents,
      discountType: result.coupon.discountType,
      durationType: result.coupon.durationType,
      durationInMonths: result.coupon.durationInMonths,
    })
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid coupon' })
  }
})

export default router
