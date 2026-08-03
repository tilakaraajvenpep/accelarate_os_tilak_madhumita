import { Router, Response } from 'express'
import { z } from 'zod'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import { listPillarsForCompany, listPillarDefinitions, upsertPillarDefinition } from '../services/company-pillars.service'
import { getCompanyForUser } from '../services/company-members.service'

const router = Router()

// Named pillar-progress (not "pillars") — that path is already taken by the
// separate, admin-curated Program/Pillar/Section catalog feature. This route
// is the founder's own dynamic-pillar completion view (Phase 2 Forms system).
router.get('/tenants/me/pillar-progress', requireAuth, loadUser, requireRole('founder'), async (req: AuthRequest, res: Response) => {
  const tenantId = req.dbUser!.tenantId
  if (!tenantId) {
    res.status(400).json({ error: 'No tenant associated with this account' })
    return
  }
  const company = await getCompanyForUser(tenantId, req.dbUser!.id)
  if (!company) {
    res.status(404).json({ error: 'No company found for this account' })
    return
  }
  const pillars = await listPillarsForCompany(tenantId, company.id)
  res.json(pillars)
})

router.get(
  '/tenants/me/pillar-definitions',
  requireAuth,
  loadUser,
  requireRole('admin'),
  async (req: AuthRequest, res: Response) => {
    const tenantId = req.dbUser!.tenantId
    if (!tenantId) {
      res.status(400).json({ error: 'No tenant associated with this account' })
      return
    }
    const definitions = await listPillarDefinitions(tenantId)
    res.json(definitions)
  },
)

const upsertSchema = z.object({ pillarNumber: z.number().int().positive(), title: z.string().min(1) })

router.put(
  '/tenants/me/pillar-definitions',
  requireAuth,
  loadUser,
  requireRole('admin'),
  async (req: AuthRequest, res: Response) => {
    const tenantId = req.dbUser!.tenantId
    if (!tenantId) {
      res.status(400).json({ error: 'No tenant associated with this account' })
      return
    }
    const parsed = upsertSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }
    const definition = await upsertPillarDefinition(tenantId, parsed.data.pillarNumber, parsed.data.title)
    res.json(definition)
  },
)

export default router
