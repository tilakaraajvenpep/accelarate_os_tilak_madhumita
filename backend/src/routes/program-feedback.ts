import { Router, Response } from 'express'
import { z } from 'zod'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import { getCompanyForUser } from '../services/company-members.service'
import {
  upsertFeedbackMapping,
  getFeedbackMapping,
  getFeedbackState,
  saveFeedbackResponse,
  dismissFeedbackResponse,
  reopenFeedbackResponse,
  ProgramFeedbackError,
} from '../services/program-feedback.service'

const router = Router()

function tenantOf(req: AuthRequest, res: Response): number | null {
  const tenantId = req.dbUser!.tenantId
  if (!tenantId) {
    res.status(400).json({ error: 'No tenant associated with this account' })
    return null
  }
  return tenantId
}

function handleError(err: unknown, res: Response) {
  if (err instanceof ProgramFeedbackError) {
    res.status(err.status).json({ error: err.message })
    return
  }
  console.error('[program-feedback routes]', err)
  res.status(500).json({ error: 'Something went wrong' })
}

/** Founder resolves their own company; admin/mentor must pass ?companyId=. */
async function resolveCompanyId(req: AuthRequest, res: Response, tenantId: number): Promise<number | null> {
  if (req.dbUser!.role === 'founder') {
    const company = await getCompanyForUser(tenantId, req.dbUser!.id)
    if (!company) {
      res.status(404).json({ error: 'No company found for this account' })
      return null
    }
    return company.id
  }
  const companyId = req.query.companyId ? Number(req.query.companyId) : NaN
  if (!companyId) {
    res.status(400).json({ error: 'companyId query parameter is required' })
    return null
  }
  return companyId
}

const anyGate = [requireAuth, loadUser, requireRole('admin', 'mentor', 'founder')] as const
const adminGate = [requireAuth, loadUser, requireRole('admin')] as const
const reviewGate = [requireAuth, loadUser, requireRole('admin', 'mentor')] as const

const mappingSchema = z.object({
  formTemplateId: z.number().int(),
  mandatory: z.boolean(),
  collaborationMode: z.enum(['primary_founder', 'open']),
})

router.post('/programs/:programId/feedback-mapping', ...adminGate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = mappingSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  res.status(201).json(await upsertFeedbackMapping(tenantId, Number(req.params.programId), parsed.data))
})

router.get('/programs/:programId/feedback-mapping', ...anyGate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  res.json(await getFeedbackMapping(tenantId, Number(req.params.programId)))
})

router.get('/programs/:programId/feedback', ...anyGate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const companyId = await resolveCompanyId(req, res, tenantId)
  if (companyId === null) return

  const state = await getFeedbackState(tenantId, companyId, Number(req.params.programId), req.dbUser!)
  res.json(state)
})

const saveSchema = z.object({ responseJson: z.record(z.string(), z.unknown()), submit: z.boolean() })

router.put('/programs/:programId/feedback', ...anyGate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const companyId = await resolveCompanyId(req, res, tenantId)
  if (companyId === null) return
  const parsed = saveSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  try {
    res.json(await saveFeedbackResponse(tenantId, companyId, Number(req.params.programId), req.dbUser!, parsed.data))
  } catch (err) {
    handleError(err, res)
  }
})

router.post('/programs/:programId/feedback/dismiss', ...anyGate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const companyId = await resolveCompanyId(req, res, tenantId)
  if (companyId === null) return

  try {
    res.json(await dismissFeedbackResponse(tenantId, companyId, Number(req.params.programId)))
  } catch (err) {
    handleError(err, res)
  }
})

router.post('/programs/:programId/feedback/reopen', ...reviewGate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const companyId = req.query.companyId ? Number(req.query.companyId) : NaN
  if (!companyId) { res.status(400).json({ error: 'companyId query parameter is required' }); return }

  try {
    res.json(await reopenFeedbackResponse(tenantId, companyId, Number(req.params.programId)))
  } catch (err) {
    handleError(err, res)
  }
})

export default router
