import { Router, Response } from 'express'
import { z } from 'zod'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import { listCohortDocuments, getCohortDocument, uploadCohortDocument, deleteCohortDocument, MAX_DOCUMENT_FILE_BYTES } from '../services/cohort-documents.service'
import { getCompanyForUser } from '../services/company-members.service'

const router = Router()

function tenantOf(req: AuthRequest, res: Response): number | null {
  const tenantId = req.dbUser!.tenantId
  if (!tenantId) {
    res.status(400).json({ error: 'No tenant associated with this account' })
    return null
  }
  return tenantId
}

const gate = [requireAuth, loadUser, requireRole('admin', 'mentor')] as const
const founderGate = [requireAuth, loadUser, requireRole('founder')] as const

// ── Admin + mentor: manage a cohort's documents ─────────────────────────────

router.get('/tenants/me/cohorts/:id/documents', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  res.json(await listCohortDocuments(tenantId, Number(req.params.id)))
})

router.get('/tenants/me/cohorts/:id/documents/:docId', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const doc = await getCohortDocument(tenantId, Number(req.params.docId))
  if (!doc || doc.cohortId !== Number(req.params.id)) { res.status(404).json({ error: 'Document not found' }); return }
  res.json(doc)
})

const uploadSchema = z.object({
  title: z.string().min(1),
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  fileData: z.string().min(1),
  fileSize: z.number().int().positive(),
})

router.post('/tenants/me/cohorts/:id/documents', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = uploadSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  if (parsed.data.fileSize > MAX_DOCUMENT_FILE_BYTES) {
    res.status(400).json({ error: 'File is too large — the limit is 8MB' })
    return
  }
  try {
    const created = await uploadCohortDocument({
      tenantId,
      cohortId: Number(req.params.id),
      uploadedByUserId: req.dbUser!.id,
      ...parsed.data,
    })
    res.json(created)
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to upload document' })
  }
})

router.delete('/tenants/me/cohorts/:id/documents/:docId', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  try {
    await deleteCohortDocument(tenantId, Number(req.params.docId), req.dbUser!.id, req.dbUser!.role === 'admin')
    res.json({ success: true })
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to delete document' })
  }
})

// ── Founder: read-only, scoped to their own company's cohort ───────────────

router.get('/tenants/me/founder/documents', ...founderGate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const company = await getCompanyForUser(tenantId, req.dbUser!.id)
  if (!company || !company.cohortId) { res.json([]); return }
  res.json(await listCohortDocuments(tenantId, company.cohortId))
})

router.get('/tenants/me/founder/documents/:docId', ...founderGate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const company = await getCompanyForUser(tenantId, req.dbUser!.id)
  if (!company || !company.cohortId) { res.status(404).json({ error: 'Document not found' }); return }
  const doc = await getCohortDocument(tenantId, Number(req.params.docId))
  if (!doc || doc.cohortId !== company.cohortId) { res.status(404).json({ error: 'Document not found' }); return }
  res.json(doc)
})

export default router
