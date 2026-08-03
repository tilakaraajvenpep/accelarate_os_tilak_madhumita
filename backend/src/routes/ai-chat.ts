import { Router, Response } from 'express'
import { z } from 'zod'
import { requireAuth, loadUser, type AuthRequest } from '../middleware/auth.middleware'
import { chat } from '../services/ai-chat.service'
import { InsufficientCreditsError } from '../services/ai-credits.service'

const router = Router()

const chatSchema = z.object({
  message: z.string().min(1),
  history: z.array(z.object({ role: z.string(), content: z.string() })).optional().default([]),
})

router.post('/ai-chat', requireAuth, loadUser, async (req: AuthRequest, res: Response) => {
  const parsed = chatSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const response = await chat(parsed.data.message, parsed.data.history, req.dbUser!)
    res.json({ response })
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      res.status(402).json({ error: err.message })
      return
    }
    throw err
  }
})

export default router
