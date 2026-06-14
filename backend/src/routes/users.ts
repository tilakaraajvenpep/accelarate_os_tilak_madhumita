import { Router, Response } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware'
import { getUserBySub } from '../services/users.service'

const router = Router()

router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const user = await getUserBySub(req.user!.sub)
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId,
  })
})

export default router
