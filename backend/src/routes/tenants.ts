import { Router, Response } from 'express'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import { listTenantsWithSubscription } from '../services/tenants.service'

const router = Router()

router.get('/', requireAuth, loadUser, requireRole('super_admin'), async (_req: AuthRequest, res: Response) => {
  const tenants = await listTenantsWithSubscription()
  res.json(tenants)
})

export default router
