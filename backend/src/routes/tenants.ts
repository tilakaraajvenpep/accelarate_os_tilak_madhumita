import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import {
  listTenantsWithSubscription,
  createTenantWithAdmin,
  getTenantBySlug,
  deleteTenant,
  setTenantEmailServiceEnabled,
  sendTenantAdminOtp,
} from '../services/tenants.service'

const router = Router()

const createTenantSchema = z.object({
  name: z.string().min(1),
  orgType: z
    .enum(['university', 'corporate', 'vc_backed', 'government', 'independent', 'other'])
    .optional(),
  website: z.string().url().optional().or(z.literal('')),
  slug: z.string().min(1).optional(),
  adminEmail: z.string().email(),
  adminName: z.string().min(1),
  adminPassword: z.string().min(8),
  otpCode: z.string().min(1),
})

const sendCodeSchema = z.object({
  adminEmail: z.string().email(),
  name: z.string().min(1),
})

router.get('/', requireAuth, loadUser, requireRole('super_admin'), async (_req: AuthRequest, res: Response) => {
  const tenants = await listTenantsWithSubscription()
  res.json(tenants)
})

router.post(
  '/send-verification-code',
  requireAuth,
  loadUser,
  requireRole('super_admin'),
  async (req: AuthRequest, res: Response) => {
    const parsed = sendCodeSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }
    try {
      await sendTenantAdminOtp(parsed.data.adminEmail, parsed.data.name)
      res.json({ message: 'Verification code sent' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send verification code'
      res.status(400).json({ error: msg })
    }
  },
)

router.post('/', requireAuth, loadUser, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const parsed = createTenantSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const tenant = await createTenantWithAdmin({
      name: parsed.data.name,
      orgType: parsed.data.orgType,
      website: parsed.data.website || null,
      slug: parsed.data.slug,
      adminEmail: parsed.data.adminEmail,
      adminName: parsed.data.adminName,
      adminPassword: parsed.data.adminPassword,
      otpCode: parsed.data.otpCode,
    })
    res.json({ tenant })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create tenant'
    res.status(400).json({ error: msg })
  }
})

router.delete('/:id', requireAuth, loadUser, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id)
  try {
    await deleteTenant(id)
    res.json({ message: 'Tenant deleted' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete tenant'
    res.status(400).json({ error: msg })
  }
})

const emailServiceSchema = z.object({ enabled: z.boolean() })

router.patch('/:id/email-service', requireAuth, loadUser, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id)
  const parsed = emailServiceSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const tenant = await setTenantEmailServiceEnabled(id, parsed.data.enabled)
    res.json(tenant)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update tenant'
    res.status(400).json({ error: msg })
  }
})

router.get('/by-slug/:slug', async (req: Request, res: Response) => {
  const tenant = await getTenantBySlug(req.params.slug)
  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' })
    return
  }
  res.json(tenant)
})

export default router
