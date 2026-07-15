import { Router, Response } from 'express'
import { z } from 'zod'
import { eq, count } from 'drizzle-orm'
import { db } from '../db/client'
import { tenants, subscriptions, plans } from '../models'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import { getPlatformSettings, setAiCreditRateCents } from '../services/platform-settings.service'

const router = Router()

router.get('/stats', requireAuth, loadUser, requireRole('super_admin'), async (_req: AuthRequest, res: Response) => {
  const [tenantCountRow] = await db.select({ value: count() }).from(tenants)

  const activeSubs = await db
    .select({ priceMonthlyCents: plans.priceMonthlyCents })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(eq(subscriptions.status, 'active'))

  const mrrCents = activeSubs.reduce((sum, row) => sum + row.priceMonthlyCents, 0)

  res.json({
    tenants: tenantCountRow?.value ?? 0,
    mrrCents,
    activeSubscriptions: activeSubs.length,
    totalCompanies: null,
    avgPlatformScore: null,
  })
})

router.get('/settings', requireAuth, loadUser, requireRole('admin', 'super_admin'), async (_req: AuthRequest, res: Response) => {
  const settings = await getPlatformSettings()
  res.json(settings)
})

const updateSettingsSchema = z.object({
  aiCreditRateCents: z.number().int().min(0),
})

router.patch('/settings', requireAuth, loadUser, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const parsed = updateSettingsSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const settings = await setAiCreditRateCents(parsed.data.aiCreditRateCents)
    res.json(settings)
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update settings' })
  }
})

export default router
