import { Router, Response } from 'express'
import { eq, count } from 'drizzle-orm'
import { db } from '../db/client'
import { tenants, subscriptions, plans } from '../models'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'

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

export default router
