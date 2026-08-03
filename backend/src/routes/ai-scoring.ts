import { Router, Response } from 'express'
import { z } from 'zod'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import { scoreAnswer } from '../services/ai-scoring.service'

const router = Router()

const analyzeSchema = z.object({ question: z.string(), answer: z.string() })

router.post(
  '/tenants/me/ai-scoring/analyze',
  requireAuth,
  loadUser,
  requireRole('founder'),
  async (req: AuthRequest, res: Response) => {
    const parsed = analyzeSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }
    const result = await scoreAnswer(req.dbUser!.tenantId, parsed.data.question, parsed.data.answer)
    res.json(result)
  },
)

export default router
