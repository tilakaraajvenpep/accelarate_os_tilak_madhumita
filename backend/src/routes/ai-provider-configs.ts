import { Router, Response } from 'express'
import { z } from 'zod'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import {
  listAiProviderConfigs,
  createAiProviderConfig,
  updateAiProviderConfig,
  setAiProviderConfigEnabled,
  deleteAiProviderConfig,
} from '../services/ai-provider-configs.service'

const router = Router()

router.use(requireAuth, loadUser, requireRole('super_admin'))

router.get('/', async (_req: AuthRequest, res: Response) => {
  const configs = await listAiProviderConfigs()
  res.json(configs)
})

const createSchema = z.object({
  provider: z.enum(['openai', 'anthropic']),
  model: z.string().min(1),
  apiKey: z.string().min(1),
})

router.post('/', async (req: AuthRequest, res: Response) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const config = await createAiProviderConfig(parsed.data)
    res.json(config)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create AI key'
    res.status(400).json({ error: msg })
  }
})

const updateSchema = z.object({
  model: z.string().min(1).optional(),
  apiKey: z.string().min(1).optional(),
})

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id)
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const config = await updateAiProviderConfig(id, parsed.data)
    res.json(config)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update AI key'
    res.status(400).json({ error: msg })
  }
})

const enabledSchema = z.object({ enabled: z.boolean() })

router.patch('/:id/enabled', async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id)
  const parsed = enabledSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const config = await setAiProviderConfigEnabled(id, parsed.data.enabled)
    res.json(config)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update AI key'
    res.status(400).json({ error: msg })
  }
})

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id)
  try {
    await deleteAiProviderConfig(id)
    res.json({ message: 'AI key deleted' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete AI key'
    res.status(400).json({ error: msg })
  }
})

export default router
