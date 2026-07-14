import { Router, Response } from 'express'
import { z } from 'zod'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import { listTenantsWithSubscription, setTenantEmailServiceEnabled } from '../services/tenants.service'

const router = Router()

const emailServiceSchema = z.object({
  enabled: z.boolean(),
})

router.get('/', requireAuth, loadUser, requireRole('super_admin'), async (_req: AuthRequest, res: Response) => {
  const tenants = await listTenantsWithSubscription()
  res.json(tenants)
})

router.patch('/:id/email-service', requireAuth, loadUser, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const parsed = emailServiceSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const tenant = await setTenantEmailServiceEnabled(Number(req.params.id), parsed.data.enabled)
    res.json(tenant)
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update tenant' })
  }
})

export default router
