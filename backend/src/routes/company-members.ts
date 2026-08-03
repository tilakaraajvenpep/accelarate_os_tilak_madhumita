import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import { db } from '../db/client'
import { companies } from '../models'
import { eq } from 'drizzle-orm'
import {
  isCompanyMember,
  listCompanyMembers,
  inviteCompanyMember,
  acceptCompanyMemberInvite,
  removeCompanyMember,
} from '../services/company-members.service'

const router = Router()

async function requireMembership(req: AuthRequest, res: Response, companyId: number): Promise<boolean> {
  const isMember = await isCompanyMember(companyId, req.dbUser!.id)
  if (!isMember) {
    res.status(403).json({ error: 'Forbidden' })
    return false
  }
  return true
}

router.get(
  '/tenants/me/companies/:companyId/members',
  requireAuth,
  loadUser,
  requireRole('founder'),
  async (req: AuthRequest, res: Response) => {
    const companyId = Number(req.params.companyId)
    if (!(await requireMembership(req, res, companyId))) return
    const members = await listCompanyMembers(companyId)
    res.json(members)
  },
)

const inviteSchema = z.object({ email: z.string().email() })

router.post(
  '/tenants/me/companies/:companyId/members/invite',
  requireAuth,
  loadUser,
  requireRole('founder'),
  async (req: AuthRequest, res: Response) => {
    const companyId = Number(req.params.companyId)
    if (!(await requireMembership(req, res, companyId))) return
    const parsed = inviteSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1)
    if (!company) {
      res.status(404).json({ error: 'Company not found' })
      return
    }
    try {
      await inviteCompanyMember({
        tenantId: req.dbUser!.tenantId!,
        companyId,
        companyName: company.name ?? '',
        email: parsed.data.email,
        invitedByUserId: req.dbUser!.id,
        inviterName: req.dbUser!.name ?? req.dbUser!.email,
      })
      res.json({ ok: true })
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to send invite' })
    }
  },
)

router.delete(
  '/tenants/me/companies/:companyId/members/:userId',
  requireAuth,
  loadUser,
  requireRole('founder'),
  async (req: AuthRequest, res: Response) => {
    const companyId = Number(req.params.companyId)
    if (!(await requireMembership(req, res, companyId))) return
    try {
      await removeCompanyMember(companyId, Number(req.params.userId))
      res.json({ ok: true })
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to remove member' })
    }
  },
)

// Public — the invitee isn't authenticated yet.
const acceptSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  name: z.string().min(1).optional(),
  password: z.string().min(8).optional(),
})

router.post('/company-member-invites/:companyId/accept', async (req: Request, res: Response) => {
  const parsed = acceptSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const result = await acceptCompanyMemberInvite({ companyId: Number(req.params.companyId), ...parsed.data })
    res.json(result)
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to accept invite' })
  }
})

export default router
