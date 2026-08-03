import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { eq, count } from 'drizzle-orm'
import { db } from '../db/client'
import { tenants, subscriptions, plans } from '../models'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import {
  getPlatformSettings,
  setAiCreditRateCents,
  setAiCreditsPerThousandTokens,
  getTenantOnboardingSourceTenantId,
  setTenantOnboardingSourceTenantId,
  resolvePublicTenantOnboardingForm,
} from '../services/platform-settings.service'

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
  aiCreditRateCents: z.number().int().min(0).optional(),
  aiCreditsPerThousandTokens: z.number().int().min(0).optional(),
})

router.patch('/settings', requireAuth, loadUser, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const parsed = updateSettingsSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    let settings = await getPlatformSettings()
    if (parsed.data.aiCreditRateCents !== undefined) {
      settings = await setAiCreditRateCents(parsed.data.aiCreditRateCents)
    }
    if (parsed.data.aiCreditsPerThousandTokens !== undefined) {
      settings = await setAiCreditsPerThousandTokens(parsed.data.aiCreditsPerThousandTokens)
    }
    res.json(settings)
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update settings' })
  }
})

// Public — read by the unauthenticated /get-started "organization details" step.
// Resolves the source tenant's own 'tenant_admin_onboarding' Forms > Mappings
// entry; null means that step falls back to the hardcoded name/type/website fields.
router.get('/tenant-onboarding-form', async (_req: Request, res: Response) => {
  res.json(await resolvePublicTenantOnboardingForm())
})

router.get('/tenant-onboarding-source', requireAuth, loadUser, requireRole('super_admin'), async (_req: AuthRequest, res: Response) => {
  res.json({ sourceTenantId: await getTenantOnboardingSourceTenantId() })
})

const tenantOnboardingSourceSchema = z.object({
  sourceTenantId: z.number().int().nullable(),
})

router.patch('/tenant-onboarding-source', requireAuth, loadUser, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const parsed = tenantOnboardingSourceSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    res.json({ sourceTenantId: await setTenantOnboardingSourceTenantId(parsed.data.sourceTenantId) })
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save onboarding source tenant' })
  }
})

export default router
