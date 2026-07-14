import { Router, Response } from 'express'
import { z } from 'zod'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import { listPlans, createPlan, updatePlan } from '../services/plans.service'

const router = Router()

const planSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  cohortsLimit: z.number().int().positive().nullable().optional(),
  foundersLimit: z.number().int().positive().nullable().optional(),
  storageLimitGb: z.number().int().positive().nullable().optional(),
  priceMonthlyCents: z.number().int().min(0),
  isCustom: z.boolean().optional(),
  enableOnlineBilling: z.boolean().optional(),
  aiProviderConfigId: z.number().int().positive().nullable().optional(),
})

const updatePlanSchema = planSchema.partial().extend({
  active: z.boolean().optional(),
})

router.get('/', requireAuth, loadUser, requireRole('super_admin'), async (_req: AuthRequest, res: Response) => {
  const plans = await listPlans()
  res.json(plans)
})

router.post('/', requireAuth, loadUser, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const parsed = planSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const plan = await createPlan(parsed.data)
    res.json(plan)
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create plan' })
  }
})

router.patch('/:id', requireAuth, loadUser, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id)
  const parsed = updatePlanSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const plan = await updatePlan(id, parsed.data)
    if (!plan) {
      res.status(404).json({ error: 'Plan not found' })
      return
    }
    res.json(plan)
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update plan' })
  }
})

export default router
