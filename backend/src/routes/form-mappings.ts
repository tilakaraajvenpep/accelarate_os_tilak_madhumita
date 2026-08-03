import { Router, Response } from 'express'
import { z } from 'zod'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import { listFormMappings, createFormMapping, reorderFormMappings, deleteFormMapping } from '../services/form-mappings.service'

const router = Router()

const createSchema = z.object({
  templateId: z.number().int(),
  cohortId: z.number().int().nullable().optional(),
  type: z.string().min(1),
  contextId: z.string().min(1),
  sectionId: z.string().optional(),
})

const reorderSchema = z.object({
  orderedIds: z.array(z.number().int()),
})

function requireTenantId(req: AuthRequest, res: Response): number | null {
  const tenantId = req.dbUser!.tenantId
  if (!tenantId) {
    res.status(400).json({ error: 'No tenant associated with this account' })
    return null
  }
  return tenantId
}

router.get(
  '/tenants/me/form-mappings',
  requireAuth,
  loadUser,
  requireRole('admin'),
  async (req: AuthRequest, res: Response) => {
    const tenantId = requireTenantId(req, res)
    if (tenantId === null) return
    const type = typeof req.query.type === 'string' ? req.query.type : undefined
    const mappings = await listFormMappings(tenantId, type)
    res.json(mappings)
  },
)

router.post(
  '/tenants/me/form-mappings',
  requireAuth,
  loadUser,
  requireRole('admin'),
  async (req: AuthRequest, res: Response) => {
    const tenantId = requireTenantId(req, res)
    if (tenantId === null) return
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }
    try {
      const mapping = await createFormMapping({ tenantId, ...parsed.data })
      res.json(mapping)
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create mapping' })
    }
  },
)

router.put(
  '/tenants/me/form-mappings/reorder',
  requireAuth,
  loadUser,
  requireRole('admin'),
  async (req: AuthRequest, res: Response) => {
    const tenantId = requireTenantId(req, res)
    if (tenantId === null) return
    const parsed = reorderSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }
    await reorderFormMappings(tenantId, parsed.data.orderedIds)
    res.json({ message: 'Reordered' })
  },
)

router.delete(
  '/tenants/me/form-mappings/:id',
  requireAuth,
  loadUser,
  requireRole('admin'),
  async (req: AuthRequest, res: Response) => {
    const tenantId = requireTenantId(req, res)
    if (tenantId === null) return
    try {
      await deleteFormMapping(tenantId, Number(req.params.id))
      res.json({ message: 'Mapping deleted' })
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to delete mapping' })
    }
  },
)

export default router
