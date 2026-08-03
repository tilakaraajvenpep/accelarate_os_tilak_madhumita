import { Router, Response } from 'express'
import { z } from 'zod'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import { listPlans, listSelfServePlans, createPlan, updatePlan, deletePlan } from '../services/plans.service'

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
  aiCredits: z.number().int().min(0).optional(),
  aiProviderConfigIds: z.array(z.number().int()).optional(),
})

const updatePlanSchema = planSchema.partial().extend({
  active: z.boolean().optional(),
})

router.get('/', requireAuth, loadUser, requireRole('super_admin'), async (_req: AuthRequest, res: Response) => {
  const plans = await listPlans()
  res.json(plans)
})

// Self-serve plan picker for the signup wizard's payment step — any admin can see what's available to buy.
router.get('/active', requireAuth, loadUser, requireRole('admin', 'super_admin'), async (_req: AuthRequest, res: Response) => {
  const plans = await listSelfServePlans()
  res.json(
    plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      priceMonthlyCents: plan.priceMonthlyCents,
      aiCredits: plan.aiCredits,
      cohortsLimit: plan.cohortsLimit,
      foundersLimit: plan.foundersLimit,
      storageLimitGb: plan.storageLimitGb,
      onlineBillingEnabled: !!plan.stripePriceId,
    })),
  )
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

router.delete('/:id', requireAuth, loadUser, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id)
  try {
    await deletePlan(id)
    res.json({ message: 'Plan deleted' })
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to delete plan' })
  }
})

export default router
