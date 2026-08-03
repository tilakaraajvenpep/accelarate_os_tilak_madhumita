import { Router, Response } from 'express'
import { z } from 'zod'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import { getCompanyForUser } from '../services/company-members.service'
import {
  createGovernanceConfig,
  getGovernanceConfigs,
  initializeGovernanceSession,
  getGovernanceSessions,
  getGovernanceSessionById,
  submitGovernanceSession,
  submitReview,
  reopenSession,
  generateGovernanceDocument,
  getGovernanceDocument,
  GovernanceError,
} from '../services/governance.service'

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
  if (err instanceof GovernanceError) {
    res.status(err.status).json({ error: err.message })
    return
  }
  console.error('[governance routes]', err)
  res.status(500).json({ error: 'Something went wrong' })
}

const adminGate = [requireAuth, loadUser, requireRole('admin')] as const
const reviewGate = [requireAuth, loadUser, requireRole('admin', 'mentor')] as const
const anyGate = [requireAuth, loadUser, requireRole('admin', 'mentor', 'founder')] as const
const founderGate = [requireAuth, loadUser, requireRole('founder')] as const

// ─── Configs ──────────────────────────────────────────────────────────────

const configSchema = z.object({
  cohortId: z.number().int().optional(),
  applicablePillars: z.array(z.number().int()),
  purpose: z.string().optional(),
})

router.post('/governance/configs', ...adminGate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = configSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  res.status(201).json(await createGovernanceConfig(tenantId, parsed.data))
})

router.get('/governance/configs', ...anyGate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const cohortId = req.query.cohortId ? Number(req.query.cohortId) : undefined
  res.json(await getGovernanceConfigs(tenantId, cohortId))
})

// ─── Sessions ─────────────────────────────────────────────────────────────

const initSessionSchema = z.object({
  configId: z.number().int(),
  companyId: z.number().int().optional(),
})

router.post('/governance/sessions', ...anyGate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = initSessionSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  let companyId = parsed.data.companyId
  if (req.dbUser!.role === 'founder') {
    const company = await getCompanyForUser(tenantId, req.dbUser!.id)
    if (!company) { res.status(404).json({ error: 'No company found for this account' }); return }
    companyId = company.id
  }
  if (!companyId) { res.status(400).json({ error: 'companyId is required' }); return }

  try {
    res.status(201).json(await initializeGovernanceSession(tenantId, { configId: parsed.data.configId, companyId }))
  } catch (err) {
    handleError(err, res)
  }
})

router.get('/governance/sessions', ...anyGate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return

  let companyId = req.query.companyId ? Number(req.query.companyId) : undefined
  if (req.dbUser!.role === 'founder') {
    const company = await getCompanyForUser(tenantId, req.dbUser!.id)
    companyId = company?.id
    if (!companyId) { res.json([]); return }
  }
  res.json(await getGovernanceSessions(tenantId, companyId))
})

router.get('/governance/sessions/:sessionId', ...anyGate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  try {
    res.json(await getGovernanceSessionById(tenantId, Number(req.params.sessionId)))
  } catch (err) {
    handleError(err, res)
  }
})

const submitSchema = z.object({ founderNotes: z.string().optional() })

router.post('/governance/sessions/:sessionId/submit', ...founderGate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = submitSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  try {
    res.json(await submitGovernanceSession(tenantId, Number(req.params.sessionId), parsed.data))
  } catch (err) {
    handleError(err, res)
  }
})

// ─── Review ───────────────────────────────────────────────────────────────

const reviewSchema = z.object({ feedback: z.string(), outcome: z.string() })

router.post('/governance/sessions/:sessionId/review', ...reviewGate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = reviewSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  try {
    res.json(await submitReview(tenantId, Number(req.params.sessionId), parsed.data))
  } catch (err) {
    handleError(err, res)
  }
})

const reopenSchema = z.object({ feedback: z.string().optional() })

router.post('/governance/sessions/:sessionId/reopen', ...reviewGate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = reopenSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  try {
    res.json(await reopenSession(tenantId, Number(req.params.sessionId), parsed.data))
  } catch (err) {
    handleError(err, res)
  }
})

// ─── Generation ───────────────────────────────────────────────────────────

router.post('/governance/sessions/:sessionId/generate-document', ...reviewGate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  try {
    res.status(201).json(await generateGovernanceDocument(tenantId, Number(req.params.sessionId)))
  } catch (err) {
    handleError(err, res)
  }
})

router.get('/governance/sessions/:sessionId/document', ...anyGate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  try {
    const pdfBuffer = await getGovernanceDocument(tenantId, Number(req.params.sessionId))
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="governance-report-${req.params.sessionId}.pdf"`)
    res.send(pdfBuffer)
  } catch (err) {
    handleError(err, res)
  }
})

export default router
