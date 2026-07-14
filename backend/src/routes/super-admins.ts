import { Router, Response } from 'express'
import { z } from 'zod'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import {
  listSuperAdmins,
  createSuperAdmin,
  verifySuperAdminOtp,
  updateSuperAdmin,
  setSuperAdminActive,
  deleteSuperAdmin,
} from '../services/super-admins.service'
import { sendSuperAdminOtpEmail, sendSuperAdminEmailChangedNotice } from '../services/ses.service'

const router = Router()

router.use(requireAuth, loadUser, requireRole('super_admin'))

router.get('/', async (_req: AuthRequest, res: Response) => {
  const admins = await listSuperAdmins()
  res.json(admins)
})

const createSchema = z.object({
  name: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(8),
})

router.post('/', async (req: AuthRequest, res: Response) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const { code } = await createSuperAdmin(parsed.data)

    let emailSent = true
    try {
      await sendSuperAdminOtpEmail({ to: parsed.data.email, code })
    } catch (emailErr) {
      emailSent = false
      console.error('[super-admins] failed to send OTP email:', emailErr)
    }

    res.json({ emailSent })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create super admin'
    res.status(400).json({ error: msg })
  }
})

const verifyOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
})

router.post('/verify-otp', async (req: AuthRequest, res: Response) => {
  const parsed = verifyOtpSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    await verifySuperAdminOtp(parsed.data.email, parsed.data.code)
    res.json({ message: 'Email verified.' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Verification failed'
    res.status(400).json({ error: msg })
  }
})

const updateSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
})

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id)
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const { user, tempPassword } = await updateSuperAdmin(id, parsed.data)

    if (tempPassword) {
      try {
        await sendSuperAdminEmailChangedNotice({ to: user.email, tempPassword })
      } catch (emailErr) {
        console.error('[super-admins] failed to send email-changed notice:', emailErr)
      }
    }

    res.json({ user })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update super admin'
    res.status(400).json({ error: msg })
  }
})

const activeSchema = z.object({ active: z.boolean() })

router.patch('/:id/active', async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id)
  const parsed = activeSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  if (id === req.dbUser!.id) {
    res.status(400).json({ error: 'You cannot change your own active status' })
    return
  }
  try {
    const user = await setSuperAdminActive(id, parsed.data.active)
    res.json({ user })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update super admin'
    res.status(400).json({ error: msg })
  }
})

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id)
  if (id === req.dbUser!.id) {
    res.status(400).json({ error: 'You cannot delete your own account' })
    return
  }
  try {
    await deleteSuperAdmin(id)
    res.json({ message: 'Super admin deleted' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete super admin'
    res.status(400).json({ error: msg })
  }
})

export default router
