import { Router, Response } from 'express'
import { z } from 'zod'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import { AI_PROVIDER_MODELS, isValidProvider } from '../config/ai-provider-models'
import {
  listAiProviderConfigs,
  createAiProviderConfig,
  updateAiProviderConfig,
  setAiProviderConfigEnabled,
  deleteAiProviderConfig,
} from '../services/ai-provider-configs.service'

const router = Router()

const createSchema = z.object({
  provider: z.enum(['openai', 'anthropic']),
  model: z.string().min(1),
  apiKey: z.string().min(1),
})

const enabledSchema = z.object({
  enabled: z.boolean(),
})

const updateSchema = z
  .object({
    model: z.string().min(1).optional(),
    apiKey: z.string().min(1).optional(),
  })
  .refine((data) => data.model !== undefined || data.apiKey !== undefined, {
    message: 'Provide at least a model or an apiKey to update',
  })

router.get('/models', requireAuth, loadUser, requireRole('super_admin'), async (_req: AuthRequest, res: Response) => {
  res.json(AI_PROVIDER_MODELS)
})

router.get('/', requireAuth, loadUser, requireRole('super_admin'), async (_req: AuthRequest, res: Response) => {
  const configs = await listAiProviderConfigs()
  res.json(configs)
})

router.post('/', requireAuth, loadUser, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  if (!isValidProvider(parsed.data.provider)) {
    res.status(400).json({ error: 'Unknown provider' })
    return
  }
  try {
    const config = await createAiProviderConfig(parsed.data.provider, parsed.data.model, parsed.data.apiKey)
    res.json(config)
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save AI key' })
  }
})

router.patch('/:id/enabled', requireAuth, loadUser, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const parsed = enabledSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const config = await setAiProviderConfigEnabled(Number(req.params.id), parsed.data.enabled)
    res.json(config)
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update AI key' })
  }
})

router.patch('/:id', requireAuth, loadUser, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const config = await updateAiProviderConfig(Number(req.params.id), parsed.data)
    res.json(config)
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update AI key' })
  }
})

router.delete('/:id', requireAuth, loadUser, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    await deleteAiProviderConfig(Number(req.params.id))
    res.json({ ok: true })
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to delete AI key' })
  }
})

export default router
