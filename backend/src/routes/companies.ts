import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import {
  createCompanyInvite,
  listCompanyEntries,
  getInviteDetails,
  acceptCompanyInvite,
  getOrCreateDraftCompany,
  saveCompanyDraft,
  lockCompanyProfile,
} from '../services/company-invites.service'
import { getCompanyForUser } from '../services/company-members.service'

const router = Router()

const inviteSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  cohortId: z.number().int(),
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
    const cohortId = typeof req.query.cohortId === 'string' ? Number(req.query.cohortId) : undefined
    const entries = await listCompanyEntries(tenantId, cohortId)
    res.json(entries)
  },
)

// A founder (or invited co-founder) fetching the company they belong to —
// resolved via company_members, the canonical membership lookup, not
// founderUserId. Auto-creates an empty draft the first time an authenticated
// founder with no company calls this, so there's always a row to save
// onboarding answers against and the frontend never needs a separate "create" call.
router.get(
  '/tenants/me/companies/mine',
  requireAuth,
  loadUser,
  requireRole('founder'),
  async (req: AuthRequest, res: Response) => {
    const tenantId = req.dbUser!.tenantId
    if (!tenantId) {
      res.status(400).json({ error: 'No tenant associated with this account' })
      return
    }
    const existing = await getCompanyForUser(tenantId, req.dbUser!.id)
    if (existing) {
      res.json(existing)
      return
    }
    const created = await getOrCreateDraftCompany(tenantId, req.dbUser!.id, req.dbUser!.email, req.dbUser!.name ?? req.dbUser!.email)
    res.json(created)
  },
)

const companyDraftSchema = z.object({
  name: z.string().nullable().optional(),
  uen: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  companySize: z.string().nullable().optional(),
  roleInBusiness: z.string().nullable().optional(),
  mobileNumber: z.string().nullable().optional(),
  consentWhatsapp: z.boolean().optional(),
  consentEmail: z.boolean().optional(),
})

router.patch('/tenants/me/companies/mine/draft', requireAuth, loadUser, requireRole('founder'), async (req: AuthRequest, res: Response) => {
  const tenantId = req.dbUser!.tenantId
  if (!tenantId) {
    res.status(400).json({ error: 'No tenant associated with this account' })
    return
  }
  const parsed = companyDraftSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    res.json(await saveCompanyDraft(tenantId, req.dbUser!.id, parsed.data))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save draft' })
  }
})

const companyLockSchema = z.object({
  name: z.string().min(1),
  uen: z.string().nullable().optional(),
  industry: z.string().min(1),
  companySize: z.string().min(1),
  roleInBusiness: z.string().min(1),
  mobileNumber: z.string().min(1),
  consentWhatsapp: z.boolean(),
  consentEmail: z.boolean(),
  platformScopeAck: z.literal(true),
  participationAuthorityAck: z.literal(true),
})

router.post('/tenants/me/companies/mine/lock', requireAuth, loadUser, requireRole('founder'), async (req: AuthRequest, res: Response) => {
  const tenantId = req.dbUser!.tenantId
  if (!tenantId) {
    res.status(400).json({ error: 'No tenant associated with this account' })
    return
  }
  const parsed = companyLockSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    res.json(await lockCompanyProfile(tenantId, req.dbUser!.id, parsed.data))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to submit company profile' })
  }
})

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
  fullName: z.string().min(1),
})

router.post('/invites/:token/accept', async (req: Request, res: Response) => {
  const parsed = acceptSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const result = await acceptCompanyInvite(req.params.token, parsed.data.password, parsed.data.fullName)
    res.json(result)
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to accept invite' })
  }
})

export default router
