import { Router, Response } from 'express'
import { z } from 'zod'
import { eq, count } from 'drizzle-orm'
import { db } from '../db/client'
import { tenants, subscriptions, plans } from '../models'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import {
  listSuperAdmins,
  requestSuperAdminOtp,
  verifySuperAdminOtp,
  setSuperAdminDisabled,
  updateSuperAdmin,
  deleteSuperAdmin,
} from '../services/platform-admins.service'

const router = Router()

const requestOtpSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).nullable().optional(),
})

const verifyOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  password: z.string().min(8),
})

const disableSchema = z.object({
  disabled: z.boolean(),
})

const updateSuperAdminSchema = z.object({
  name: z.string().min(1).nullable().optional(),
  email: z.string().email().optional(),
})

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

router.get('/super-admins', requireAuth, loadUser, requireRole('super_admin'), async (_req: AuthRequest, res: Response) => {
  const admins = await listSuperAdmins()
  res.json(admins)
})

router.post('/super-admins/request-otp', requireAuth, loadUser, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const parsed = requestOtpSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    await requestSuperAdminOtp(parsed.data.email, parsed.data.name ?? null)
    res.json({ ok: true })
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to send verification code' })
  }
})

router.post('/super-admins/verify-otp', requireAuth, loadUser, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const parsed = verifyOtpSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const admin = await verifySuperAdminOtp(parsed.data.email, parsed.data.code, parsed.data.password)
    res.json(admin)
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to verify code' })
  }
})

router.patch('/super-admins/:id', requireAuth, loadUser, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const parsed = updateSuperAdminSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const admin = await updateSuperAdmin(Number(req.params.id), parsed.data)
    res.json(admin)
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update super admin' })
  }
})

router.patch('/super-admins/:id/disabled', requireAuth, loadUser, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const parsed = disableSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const admin = await setSuperAdminDisabled(req.dbUser!.id, Number(req.params.id), parsed.data.disabled)
    res.json(admin)
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update super admin' })
  }
})

router.delete('/super-admins/:id', requireAuth, loadUser, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    await deleteSuperAdmin(req.dbUser!.id, Number(req.params.id))
    res.json({ ok: true })
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to delete super admin' })
  }
})

export default router
