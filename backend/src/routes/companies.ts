import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import {
  createCompanyInvite,
  listCompanyEntries,
  getInviteDetails,
  acceptCompanyInvite,
  createCompanyForFounder,
} from '../services/company-invites.service'

const router = Router()

const inviteSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
})

router.post(
  '/tenants/me/company-invites',
  requireAuth,
  loadUser,
  requireRole('admin'),
  async (req: AuthRequest, res: Response) => {
    const tenantId = req.dbUser!.tenantId
    if (!tenantId) {
      res.status(400).json({ error: 'No tenant associated with this account' })
      return
    }
    const parsed = inviteSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }
    try {
      const invite = await createCompanyInvite({ tenantId, ...parsed.data })
      res.json({ id: invite.id, email: invite.email, name: invite.name, status: invite.status })
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to send invite' })
    }
  },
)

router.get(
  '/tenants/me/companies',
  requireAuth,
  loadUser,
  requireRole('admin'),
  async (req: AuthRequest, res: Response) => {
    const tenantId = req.dbUser!.tenantId
    if (!tenantId) {
      res.status(400).json({ error: 'No tenant associated with this account' })
      return
    }
    const entries = await listCompanyEntries(tenantId)
    res.json(entries)
  },
)

const companyDetailsSchema = z.object({
  name: z.string().min(1),
  location: z.string().nullable().optional(),
  establishedYear: z.number().int().min(1800).max(new Date().getFullYear()).nullable().optional(),
  founderName: z.string().min(1),
})

router.post(
  '/tenants/me/companies',
  requireAuth,
  loadUser,
  requireRole('founder'),
  async (req: AuthRequest, res: Response) => {
    const tenantId = req.dbUser!.tenantId
    if (!tenantId) {
      res.status(400).json({ error: 'No tenant associated with this account' })
      return
    }
    const parsed = companyDetailsSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }
    try {
      const company = await createCompanyForFounder({
        tenantId,
        founderUserId: req.dbUser!.id,
        founderEmail: req.dbUser!.email,
        ...parsed.data,
      })
      res.json(company)
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save company details' })
    }
  },
)

// Public — the invitee isn't authenticated yet.
router.get('/invites/:token', async (req: Request, res: Response) => {
  const details = await getInviteDetails(req.params.token)
  if (!details) {
    res.status(404).json({ error: 'This invite link is invalid or has expired' })
    return
  }
  res.json(details)
})

const acceptSchema = z.object({
  password: z.string().min(8),
})

router.post('/invites/:token/accept', async (req: Request, res: Response) => {
  const parsed = acceptSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const result = await acceptCompanyInvite(req.params.token, parsed.data.password)
    res.json(result)
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to accept invite' })
  }
})

export default router
