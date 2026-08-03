import { Router, Response } from 'express'
import { z } from 'zod'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import { listAssignedProgramsForCompany, getAssignedProgramDetailForCompany } from '../services/founder-programs.service'
import { getFormForSection, getSectionFormResponse, saveSectionFormResponse, markSectionComplete } from '../services/section-form-responses.service'
import { listMentorAssignments } from '../services/cohort-pillar-mentors.service'
import { MAX_DOCUMENT_FILE_BYTES } from '../services/cohort-documents.service'
import { getPillarNote } from '../services/pillar-notes.service'
import { listPillarComments, addPillarComment } from '../services/pillar-comments.service'

const router = Router()

const gate = [requireAuth, loadUser, requireRole('mentor')] as const

function tenantOf(req: AuthRequest, res: Response): number | null {
  const tenantId = req.dbUser!.tenantId
  if (!tenantId) {
    res.status(400).json({ error: 'No tenant associated with this account' })
    return null
  }
  return tenantId
}

/** Every pillar this mentor is assigned to on this specific cohort — empty means they have no standing here at all. */
async function allowedPillarIds(tenantId: number, mentorUserId: number, cohortId: number) {
  const assignments = await listMentorAssignments(tenantId, mentorUserId)
  return new Set(
    assignments
      .filter((a) => a.cohortId === cohortId && a.pillarId !== null)
      .map((a) => a.pillarId as number)
  )
}

type SectionResult =
  | { error: { status: number; message: string } }
  | { error?: undefined; tenantId: number }

/** Confirms the mentor is assigned to the pillar that owns this section, within this company's program tree. */
async function resolveMentorSection(
  req: AuthRequest,
  cohortId: number,
  companyId: number,
  programId: number,
  sectionId: number,
): Promise<SectionResult> {
  const tenantId = req.dbUser!.tenantId
  if (!tenantId) return { error: { status: 400, message: 'No tenant associated with this account' } }

  const allowed = await allowedPillarIds(tenantId, req.dbUser!.id, cohortId)
  if (allowed.size === 0) return { error: { status: 403, message: 'You are not assigned to this cohort' } }

  const detail = await getAssignedProgramDetailForCompany(tenantId, cohortId, companyId, programId)
  if (!detail) return { error: { status: 404, message: 'Program not found' } }

  const pillar = detail.pillars.find((p) => p.sections.some((s) => s.id === sectionId))
  if (!pillar) return { error: { status: 404, message: 'Section not found' } }
  if (!allowed.has(pillar.id)) return { error: { status: 403, message: 'You are not assigned to this pillar' } }

  const section = pillar.sections.find((s) => s.id === sectionId)!
  if (section.locked) return { error: { status: 403, message: 'This section is locked' } }

  return { tenantId }
}

router.get('/tenants/me/mentor/cohorts/:cohortId/companies/:companyId/programs', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const cohortId = Number(req.params.cohortId)
  const allowed = await allowedPillarIds(tenantId, req.dbUser!.id, cohortId)
  if (allowed.size === 0) { res.status(403).json({ error: 'You are not assigned to this cohort' }); return }
  res.json(await listAssignedProgramsForCompany(tenantId, cohortId, Number(req.params.companyId)))
})

router.get('/tenants/me/mentor/cohorts/:cohortId/companies/:companyId/programs/:programId', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const cohortId = Number(req.params.cohortId)
  const allowed = await allowedPillarIds(tenantId, req.dbUser!.id, cohortId)
  if (allowed.size === 0) { res.status(403).json({ error: 'You are not assigned to this cohort' }); return }
  const detail = await getAssignedProgramDetailForCompany(tenantId, cohortId, Number(req.params.companyId), Number(req.params.programId))
  if (!detail) { res.status(404).json({ error: 'Program not found' }); return }
  res.json(detail)
})

router.get(
  '/tenants/me/mentor/cohorts/:cohortId/companies/:companyId/programs/:programId/sections/:sectionId/forms/:formId',
  ...gate,
  async (req: AuthRequest, res: Response) => {
    const resolved = await resolveMentorSection(
      req,
      Number(req.params.cohortId),
      Number(req.params.companyId),
      Number(req.params.programId),
      Number(req.params.sectionId),
    )
    if (resolved.error) { res.status(resolved.error.status).json({ error: resolved.error.message }); return }

    const form = await getFormForSection(resolved.tenantId, Number(req.params.sectionId), Number(req.params.formId))
    if (!form) { res.status(404).json({ error: 'Form not found' }); return }

    const response = await getSectionFormResponse(resolved.tenantId, Number(req.params.companyId), Number(req.params.sectionId), Number(req.params.formId))
    res.json({
      form: {
        id: form.id,
        name: form.title,
        schema: form.schema,
        category: form.category,
        requireConsent: form.requireConsent,
        consentTermsText: form.consentTermsText,
      },
      response: response
        ? {
            responseJson: response.responseJson,
            status: response.status,
            document: response.documentFileName
              ? { fileName: response.documentFileName, fileType: response.documentFileType, fileData: response.documentFileData, fileSize: response.documentFileSize }
              : null,
          }
        : null,
    })
  },
)

const documentSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  fileData: z.string().min(1),
  fileSize: z.number().int().positive(),
})

const saveResponseSchema = z.object({
  responseJson: z.record(z.string(), z.unknown()),
  status: z.enum(['draft', 'submitted']),
  document: documentSchema.nullable().optional(),
})

router.put(
  '/tenants/me/mentor/cohorts/:cohortId/companies/:companyId/programs/:programId/sections/:sectionId/forms/:formId/response',
  ...gate,
  async (req: AuthRequest, res: Response) => {
    const resolved = await resolveMentorSection(
      req,
      Number(req.params.cohortId),
      Number(req.params.companyId),
      Number(req.params.programId),
      Number(req.params.sectionId),
    )
    if (resolved.error) { res.status(resolved.error.status).json({ error: resolved.error.message }); return }

    const parsed = saveResponseSchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
    if (parsed.data.document && parsed.data.document.fileSize > MAX_DOCUMENT_FILE_BYTES) {
      res.status(400).json({ error: 'File is too large — the limit is 8MB' })
      return
    }

    try {
      const saved = await saveSectionFormResponse({
        tenantId: resolved.tenantId,
        companyId: Number(req.params.companyId),
        sectionId: Number(req.params.sectionId),
        formId: Number(req.params.formId),
        responseJson: parsed.data.responseJson,
        status: parsed.data.status,
        // A mentor's override save must never assign or clobber the
        // founder team's own 'first_claim' claim on this form.
        userId: null,
        document: parsed.data.document,
      })
      res.json(saved)
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save form response' })
    }
  },
)

router.put(
  '/tenants/me/mentor/cohorts/:cohortId/companies/:companyId/programs/:programId/sections/:sectionId/complete',
  ...gate,
  async (req: AuthRequest, res: Response) => {
    const resolved = await resolveMentorSection(
      req,
      Number(req.params.cohortId),
      Number(req.params.companyId),
      Number(req.params.programId),
      Number(req.params.sectionId),
    )
    if (resolved.error) { res.status(resolved.error.status).json({ error: resolved.error.message }); return }

    try {
      const saved = await markSectionComplete(resolved.tenantId, Number(req.params.companyId), Number(req.params.sectionId))
      res.json(saved)
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to mark section complete' })
    }
  },
)

/** Confirms the mentor is assigned to this pillar, within this company's program tree. */
async function resolveMentorPillar(req: AuthRequest, cohortId: number, companyId: number, programId: number, pillarId: number): Promise<SectionResult> {
  const tenantId = req.dbUser!.tenantId
  if (!tenantId) return { error: { status: 400, message: 'No tenant associated with this account' } }

  const allowed = await allowedPillarIds(tenantId, req.dbUser!.id, cohortId)
  if (!allowed.has(pillarId)) return { error: { status: 403, message: 'You are not assigned to this pillar' } }

  const detail = await getAssignedProgramDetailForCompany(tenantId, cohortId, companyId, programId)
  if (!detail) return { error: { status: 404, message: 'Program not found' } }
  if (!detail.pillars.some((p) => p.id === pillarId)) return { error: { status: 404, message: 'Pillar not found' } }

  return { tenantId }
}

router.get(
  '/tenants/me/mentor/cohorts/:cohortId/companies/:companyId/programs/:programId/pillars/:pillarId/notes',
  ...gate,
  async (req: AuthRequest, res: Response) => {
    const resolved = await resolveMentorPillar(req, Number(req.params.cohortId), Number(req.params.companyId), Number(req.params.programId), Number(req.params.pillarId))
    if (resolved.error) { res.status(resolved.error.status).json({ error: resolved.error.message }); return }
    res.json(await getPillarNote(resolved.tenantId, Number(req.params.companyId), Number(req.params.pillarId)))
  },
)

router.get(
  '/tenants/me/mentor/cohorts/:cohortId/companies/:companyId/programs/:programId/pillars/:pillarId/comments',
  ...gate,
  async (req: AuthRequest, res: Response) => {
    const resolved = await resolveMentorPillar(req, Number(req.params.cohortId), Number(req.params.companyId), Number(req.params.programId), Number(req.params.pillarId))
    if (resolved.error) { res.status(resolved.error.status).json({ error: resolved.error.message }); return }
    res.json(await listPillarComments(resolved.tenantId, Number(req.params.companyId), Number(req.params.pillarId)))
  },
)

const mentorCommentSchema = z.object({ body: z.string().min(1) })

router.post(
  '/tenants/me/mentor/cohorts/:cohortId/companies/:companyId/programs/:programId/pillars/:pillarId/comments',
  ...gate,
  async (req: AuthRequest, res: Response) => {
    const resolved = await resolveMentorPillar(req, Number(req.params.cohortId), Number(req.params.companyId), Number(req.params.programId), Number(req.params.pillarId))
    if (resolved.error) { res.status(resolved.error.status).json({ error: resolved.error.message }); return }
    const parsed = mentorCommentSchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
    res.json(
      await addPillarComment({
        tenantId: resolved.tenantId,
        companyId: Number(req.params.companyId),
        pillarId: Number(req.params.pillarId),
        authorUserId: req.dbUser!.id,
        authorRole: 'mentor',
        body: parsed.data.body,
      }),
    )
  },
)

export default router
