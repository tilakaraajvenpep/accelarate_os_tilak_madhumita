import { Router, Response } from 'express'
import { z } from 'zod'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import { listForms, createForm, updateForm, deleteForm } from '../services/forms.service'

const router = Router()

function tenantOf(req: AuthRequest, res: Response): number | null {
  const tenantId = req.dbUser!.tenantId
  if (!tenantId) {
    res.status(400).json({ error: 'No tenant associated with this account' })
    return null
  }
  return tenantId
}

const gate = [requireAuth, loadUser, requireRole('admin')] as const

router.get('/tenants/me/forms', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  res.json(await listForms(tenantId))
})

const formQuestionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(['short_text', 'long_text', 'number', 'single_choice', 'multiple_choice', 'date']),
  required: z.boolean().optional(),
  helpText: z.string().nullable().optional(),
  options: z.array(z.string()).optional(),
})

const formSchema = z.object({
  name: z.string().min(1),
  status: z.enum(['active', 'inactive']),
  schema: z.array(formQuestionSchema).default([]),
})
const formUpdateSchema = formSchema.partial()

router.post('/tenants/me/forms', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = formSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  try {
    res.json(await createForm({ tenantId, ...parsed.data }))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create form' })
  }
})

router.patch('/tenants/me/forms/:id', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = formUpdateSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  try {
    res.json(await updateForm(tenantId, Number(req.params.id), parsed.data))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update form' })
  }
})

router.delete('/tenants/me/forms/:id', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  try {
    res.json(await deleteForm(tenantId, Number(req.params.id)))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to delete form' })
  }
})

export default router
