import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import { resolveTenantFromHeader, requireTenantMatch, type TenantRequest } from '../middleware/tenant.middleware'
import {
  listTenantsWithSubscription,
  createTenantWithAdmin,
  getTenantBySlug,
  deleteTenant,
  setTenantEmailServiceEnabled,
  sendTenantAdminOtp,
  getTenantDashboardInfo,
  getTenantNotificationSettings,
  setTenantNotificationsEnabled,
  getTenantLogo,
  setTenantLogo,
  getTenantBrandColor,
  setTenantBrandColor,
  getTenantBackgroundColor,
  setTenantBackgroundColor,
} from '../services/tenants.service'
import { formatErrorMessage } from '../utils/error-formatter'
import { isReservedSlug } from '../utils/slug'

const router = Router()

const createTenantSchema = z.object({
  name: z.string().min(1),
  orgType: z
    .enum([
      'university',
      'corporate',
      'vc_backed',
      'government',
      'independent',
      'other',
      'technology',
      'healthcare',
      'finance',
      'retail_ecommerce',
      'manufacturing',
      'education',
      'food_beverage',
      'real_estate',
      'professional_services',
    ])
    .optional(),
  website: z.string().url().optional().or(z.literal('')),
  slug: z
    .string()
    .regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/, 'Slug must be a valid subdomain label (lowercase letters, numbers, hyphens)')
    .refine((s) => !isReservedSlug(s), { message: 'This slug is reserved' })
    .optional(),
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
      const msg = formatErrorMessage(err, 'Failed to send verification code')
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
    const msg = formatErrorMessage(err, 'Failed to create tenant')
    res.status(400).json({ error: msg })
  }
})

router.delete('/:id', requireAuth, loadUser, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id)
  try {
    await deleteTenant(id)
    res.json({ message: 'Tenant deleted' })
  } catch (err: unknown) {
    const msg = formatErrorMessage(err, 'Failed to delete tenant')
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
    const msg = formatErrorMessage(err, 'Failed to update tenant')
    res.status(400).json({ error: msg })
  }
})

router.get(
  '/me/dashboard',
  requireAuth,
  loadUser,
  resolveTenantFromHeader,
  requireTenantMatch,
  requireRole('admin', 'super_admin'),
  async (req: TenantRequest, res: Response) => {
    const tenantId = req.dbUser!.tenantId
    if (!tenantId) {
      res.status(400).json({ error: 'No tenant associated with this account' })
      return
    }
    const info = await getTenantDashboardInfo(tenantId)
    if (!info) {
      res.status(404).json({ error: 'Tenant not found' })
      return
    }
    res.json(info)
  },
)

router.get('/me/notification-settings', requireAuth, loadUser, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const tenantId = req.dbUser!.tenantId
  if (!tenantId) {
    res.status(400).json({ error: 'No tenant associated with this account' })
    return
  }
  try {
    res.json(await getTenantNotificationSettings(tenantId))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to load notification settings' })
  }
})

const notificationSettingsSchema = z.object({ enabled: z.boolean() })

router.patch('/me/notification-settings', requireAuth, loadUser, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const tenantId = req.dbUser!.tenantId
  if (!tenantId) {
    res.status(400).json({ error: 'No tenant associated with this account' })
    return
  }
  const parsed = notificationSettingsSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    res.json(await setTenantNotificationsEnabled(tenantId, parsed.data.enabled))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update notification settings' })
  }
})

router.get('/me/logo', requireAuth, loadUser, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const tenantId = req.dbUser!.tenantId
  if (!tenantId) {
    res.status(400).json({ error: 'No tenant associated with this account' })
    return
  }
  try {
    res.json(await getTenantLogo(tenantId))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to load logo' })
  }
})

const logoSchema = z.object({ logoUrl: z.string().nullable() })

router.patch('/me/logo', requireAuth, loadUser, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const tenantId = req.dbUser!.tenantId
  if (!tenantId) {
    res.status(400).json({ error: 'No tenant associated with this account' })
    return
  }
  const parsed = logoSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    res.json(await setTenantLogo(tenantId, parsed.data.logoUrl))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save logo' })
  }
})

router.get('/me/brand-color', requireAuth, loadUser, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const tenantId = req.dbUser!.tenantId
  if (!tenantId) {
    res.status(400).json({ error: 'No tenant associated with this account' })
    return
  }
  try {
    res.json(await getTenantBrandColor(tenantId))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to load brand color' })
  }
})

const brandColorSchema = z.object({ brandColor: z.string().nullable() })

router.patch('/me/brand-color', requireAuth, loadUser, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const tenantId = req.dbUser!.tenantId
  if (!tenantId) {
    res.status(400).json({ error: 'No tenant associated with this account' })
    return
  }
  const parsed = brandColorSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    res.json(await setTenantBrandColor(tenantId, parsed.data.brandColor))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save brand color' })
  }
})

router.get('/me/background-color', requireAuth, loadUser, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const tenantId = req.dbUser!.tenantId
  if (!tenantId) {
    res.status(400).json({ error: 'No tenant associated with this account' })
    return
  }
  try {
    res.json(await getTenantBackgroundColor(tenantId))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to load background color' })
  }
})

const backgroundColorSchema = z.object({ backgroundColor: z.string().nullable() })

router.patch('/me/background-color', requireAuth, loadUser, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const tenantId = req.dbUser!.tenantId
  if (!tenantId) {
    res.status(400).json({ error: 'No tenant associated with this account' })
    return
  }
  const parsed = backgroundColorSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    res.json(await setTenantBackgroundColor(tenantId, parsed.data.backgroundColor))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save background color' })
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
