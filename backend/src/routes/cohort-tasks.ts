import { Router, Response } from 'express'
import { z } from 'zod'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import { listCohortTasks, createCohortTask, updateCohortTask, deleteCohortTask } from '../services/cohort-tasks.service'

const router = Router()

function tenantOf(req: AuthRequest, res: Response): number | null {
  const tenantId = req.dbUser!.tenantId
  if (!tenantId) {
    res.status(400).json({ error: 'No tenant associated with this account' })
    return null
  }
  return tenantId
}

import { getCompanyForUser } from '../services/company-members.service'

const gate = [requireAuth, loadUser, requireRole('admin')] as const

router.get('/tenants/me/cohorts/:cohortId/tasks', requireAuth, loadUser, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const user = req.dbUser!
  const cohortId = Number(req.params.cohortId)

  if (user.role === 'admin' || user.role === 'super_admin' || user.role === 'mentor') {
    try {
      res.json(await listCohortTasks(tenantId, cohortId))
    } catch (err: unknown) {
      res.status(404).json({ error: err instanceof Error ? err.message : 'Failed to load tasks' })
    }
    return
  }

  if (user.role === 'founder') {
    const company = await getCompanyForUser(tenantId, user.id)
    if (!company || company.cohortId !== cohortId) {
      res.status(403).json({ error: 'Access denied to this cohort calendar' })
      return
    }
    const tasks = await listCohortTasks(tenantId, cohortId)
    res.json(tasks.filter((t) => t.companyId === null || t.companyId === company.id))
    return
  }

  res.status(403).json({ error: 'Access denied' })
})

const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  startDate: z.string().min(1),
  endDate: z.string().nullable().optional(),
  companyId: z.number().int().nullable().optional(),
})
const taskUpdateSchema = taskSchema.partial()

router.post('/tenants/me/cohorts/:cohortId/tasks', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = taskSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  try {
    res.json(
      await createCohortTask({
        tenantId,
        cohortId: Number(req.params.cohortId),
        createdByUserId: req.dbUser!.id,
        ...parsed.data,
      }),
    )
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create task' })
  }
})

router.patch('/tenants/me/cohorts/:cohortId/tasks/:id', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = taskUpdateSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  try {
    res.json(await updateCohortTask(tenantId, Number(req.params.cohortId), Number(req.params.id), parsed.data))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update task' })
  }
})

router.delete('/tenants/me/cohorts/:cohortId/tasks/:id', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  try {
    res.json(await deleteCohortTask(tenantId, Number(req.params.cohortId), Number(req.params.id)))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to delete task' })
  }
})

export default router
