import { Router, Response } from 'express'
import { z } from 'zod'
import { eq, and, isNull, or } from 'drizzle-orm'
import { db } from '../db/client'
import { cohorts, companyMembers } from '../models'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import { getCompanyForUser } from '../services/company-members.service'
import { listAssignedProgramsForCompany, getAssignedProgramDetailForCompany, getPillarsSummaryForCompany } from '../services/founder-programs.service'
import {
  getFormForSection,
  getSectionFormResponse,
  getSectionFormResponseDocument,
  saveSectionFormResponse,
  markSectionComplete,
  resolveSectionFormAccess,
  branchSectionFormResponse,
  listResponseBranches,
} from '../services/section-form-responses.service'
import { listCohortTasks } from '../services/cohort-tasks.service'
import { MAX_DOCUMENT_FILE_BYTES } from '../services/cohort-documents.service'
import { checkProgramCompletionAndMaybeTriggerFeedback } from '../services/program-feedback.service'
import { listPillarMaterials, getPillarMaterial, uploadPillarMaterial, deletePillarMaterial } from '../services/pillar-materials.service'
import { listSectionMaterials, getSectionMaterial, uploadSectionMaterial, deleteSectionMaterial } from '../services/section-materials.service'
import { getPillarNote, savePillarNote } from '../services/pillar-notes.service'
import { listPillarComments, addPillarComment } from '../services/pillar-comments.service'
import { getPillarChecklistResponses, savePillarChecklistResponses } from '../services/pillar-checklist-responses.service'
import { pillarChecklistQuestions } from '../models'
import { notifyMentorOfPillarSubmission } from '../services/pillar-notifications.service'

const router = Router()

const gate = [requireAuth, loadUser, requireRole('founder')] as const

type AccessibleSectionResult =
  | { error: { status: number; message: string } }
  | { error?: undefined; tenantId: number; companyId: number; cohortId: number }

/** Resolves the founder's company + confirms the given section belongs to the given program's accessible (unlocked, cohort-assigned) tree. */
async function resolveAccessibleSection(req: AuthRequest, programId: number, sectionId: number): Promise<AccessibleSectionResult> {
  const tenantId = req.dbUser!.tenantId
  if (!tenantId) return { error: { status: 400, message: 'No tenant associated with this account' } }

  const company = await getCompanyForUser(tenantId, req.dbUser!.id)
  if (!company) return { error: { status: 404, message: 'No company found for this account' } }
  if (!company.cohortId) return { error: { status: 404, message: 'Program not found' } }

  const detail = await getAssignedProgramDetailForCompany(tenantId, company.cohortId, company.id, programId)
  if (!detail) return { error: { status: 404, message: 'Program not found' } }

  const section = detail.pillars.flatMap((p) => p.sections).find((s) => s.id === sectionId)
  if (!section) return { error: { status: 404, message: 'Section not found' } }
  if (section.locked) return { error: { status: 403, message: 'This section is locked' } }

  return { tenantId, companyId: company.id, cohortId: company.cohortId }
}

/** Resolves the founder's company + confirms the given pillar belongs to the given program's accessible (unlocked, cohort-assigned) tree. */
async function resolveAccessiblePillar(req: AuthRequest, programId: number, pillarId: number): Promise<AccessibleSectionResult> {
  const tenantId = req.dbUser!.tenantId
  if (!tenantId) return { error: { status: 400, message: 'No tenant associated with this account' } }

  const company = await getCompanyForUser(tenantId, req.dbUser!.id)
  if (!company) return { error: { status: 404, message: 'No company found for this account' } }
  if (!company.cohortId) return { error: { status: 404, message: 'Program not found' } }

  const detail = await getAssignedProgramDetailForCompany(tenantId, company.cohortId, company.id, programId)
  if (!detail) return { error: { status: 404, message: 'Program not found' } }

  const pillar = detail.pillars.find((p) => p.id === pillarId)
  if (!pillar) return { error: { status: 404, message: 'Pillar not found' } }
  if (pillar.locked) return { error: { status: 403, message: 'This pillar is locked' } }

  return { tenantId, companyId: company.id, cohortId: company.cohortId }
}

router.get('/tenants/me/founder/programs', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = req.dbUser!.tenantId
  if (!tenantId) { res.status(400).json({ error: 'No tenant associated with this account' }); return }

  const company = await getCompanyForUser(tenantId, req.dbUser!.id)
  if (!company) { res.status(404).json({ error: 'No company found for this account' }); return }
  if (!company.cohortId) { res.json([]); return }

  res.json(await listAssignedProgramsForCompany(tenantId, company.cohortId, company.id))
})

router.get('/tenants/me/founder/pillars-summary', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = req.dbUser!.tenantId
  if (!tenantId) { res.status(400).json({ error: 'No tenant associated with this account' }); return }

  const company = await getCompanyForUser(tenantId, req.dbUser!.id)
  if (!company) { res.status(404).json({ error: 'No company found for this account' }); return }
  if (!company.cohortId) { res.json([]); return }

  res.json(await getPillarsSummaryForCompany(tenantId, company.cohortId, company.id))
})

router.get('/tenants/me/founder/calendar', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = req.dbUser!.tenantId
  if (!tenantId) { res.status(400).json({ error: 'No tenant associated with this account' }); return }

  const company = await getCompanyForUser(tenantId, req.dbUser!.id)
  if (!company || !company.cohortId) {
    res.json({ cohortId: null, cohortName: null, tasks: [] })
    return
  }

  const tasks = await listCohortTasks(tenantId, company.cohortId)
  const founderTasks = tasks.filter((t) => t.companyId === null || t.companyId === company.id)

  const [cohort] = await db.select({ name: cohorts.name }).from(cohorts).where(and(eq(cohorts.id, company.cohortId), eq(cohorts.tenantId, tenantId))).limit(1)

  res.json({
    cohortId: company.cohortId,
    cohortName: cohort?.name ?? 'Cohort Calendar',
    tasks: founderTasks,
  })
})

router.get('/tenants/me/founder/programs/:id', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = req.dbUser!.tenantId
  if (!tenantId) { res.status(400).json({ error: 'No tenant associated with this account' }); return }

  const company = await getCompanyForUser(tenantId, req.dbUser!.id)
  if (!company) { res.status(404).json({ error: 'No company found for this account' }); return }
  if (!company.cohortId) { res.status(404).json({ error: 'Program not found' }); return }

  const detail = await getAssignedProgramDetailForCompany(tenantId, company.cohortId, company.id, Number(req.params.id), req.dbUser!.id)
  if (!detail) { res.status(404).json({ error: 'Program not found' }); return }
  res.json(detail)
})

router.get('/tenants/me/founder/programs/:programId/sections/:sectionId/forms/:formId/document', ...gate, async (req: AuthRequest, res: Response) => {
  const resolved = await resolveAccessibleSection(req, Number(req.params.programId), Number(req.params.sectionId))
  if (resolved.error) { res.status(resolved.error.status).json({ error: resolved.error.message }); return }
  const branch = typeof req.query.branch === 'string' ? Number(req.query.branch) : undefined
  const doc = await getSectionFormResponseDocument(resolved.tenantId, resolved.companyId, Number(req.params.sectionId), Number(req.params.formId), branch)
  if (!doc) { res.status(404).json({ error: 'No document attached to this response' }); return }
  res.json(doc)
})

router.get('/tenants/me/founder/programs/:programId/sections/:sectionId/forms/:formId/responses', ...gate, async (req: AuthRequest, res: Response) => {
  const resolved = await resolveAccessibleSection(req, Number(req.params.programId), Number(req.params.sectionId))
  if (resolved.error) { res.status(resolved.error.status).json({ error: resolved.error.message }); return }
  res.json(await listResponseBranches(resolved.tenantId, resolved.companyId, Number(req.params.sectionId), Number(req.params.formId)))
})

router.post('/tenants/me/founder/programs/:programId/sections/:sectionId/forms/:formId/branch', ...gate, async (req: AuthRequest, res: Response) => {
  const resolved = await resolveAccessibleSection(req, Number(req.params.programId), Number(req.params.sectionId))
  if (resolved.error) { res.status(resolved.error.status).json({ error: resolved.error.message }); return }
  try {
    const created = await branchSectionFormResponse(resolved.tenantId, resolved.companyId, Number(req.params.sectionId), Number(req.params.formId), req.dbUser!.id)
    res.json(created)
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to branch out' })
  }
})

router.get('/tenants/me/founder/programs/:programId/sections/:sectionId/forms/:formId', ...gate, async (req: AuthRequest, res: Response) => {
  const resolved = await resolveAccessibleSection(req, Number(req.params.programId), Number(req.params.sectionId))
  if (resolved.error) { res.status(resolved.error.status).json({ error: resolved.error.message }); return }

  const form = await getFormForSection(resolved.tenantId, Number(req.params.sectionId), Number(req.params.formId))
  if (!form) { res.status(404).json({ error: 'Form not found' }); return }

  const branch = typeof req.query.branch === 'string' ? Number(req.query.branch) : undefined
  const response = await getSectionFormResponse(resolved.tenantId, resolved.companyId, Number(req.params.sectionId), Number(req.params.formId), branch)
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
})

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

router.put('/tenants/me/founder/programs/:programId/sections/:sectionId/forms/:formId/response', ...gate, async (req: AuthRequest, res: Response) => {
  const resolved = await resolveAccessibleSection(req, Number(req.params.programId), Number(req.params.sectionId))
  if (resolved.error) { res.status(resolved.error.status).json({ error: resolved.error.message }); return }

  const parsed = saveResponseSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  if (parsed.data.document && parsed.data.document.fileSize > MAX_DOCUMENT_FILE_BYTES) {
    res.status(400).json({ error: 'File is too large — the limit is 8MB' })
    return
  }

  const access = await resolveSectionFormAccess(resolved.tenantId, Number(req.params.sectionId), Number(req.params.formId), resolved.companyId, req.dbUser!.id)
  if (!access) { res.status(404).json({ error: 'This form is not assigned to that section' }); return }
  if (access.access === 'view_only') {
    res.status(403).json({ error: 'This form has already been submitted and cannot be edited.' })
    return
  }
  if (access.access === 'locked') {
    res.status(403).json({ error: 'This form is already being filled by another member of your team' })
    return
  }

  const branch = typeof req.query.branch === 'string' ? Number(req.query.branch) : undefined
  try {
    const saved = await saveSectionFormResponse({
      tenantId: resolved.tenantId,
      companyId: resolved.companyId,
      sectionId: Number(req.params.sectionId),
      formId: Number(req.params.formId),
      responseJson: parsed.data.responseJson,
      status: parsed.data.status,
      userId: req.dbUser!.id,
      document: parsed.data.document,
      branchNumber: branch,
    })
    const feedbackForm =
      parsed.data.status === 'submitted'
        ? await checkProgramCompletionAndMaybeTriggerFeedback(resolved.tenantId, resolved.cohortId, resolved.companyId, Number(req.params.programId))
        : null
    res.json({ ...saved, feedbackForm })
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save form response' })
  }
})

router.put('/tenants/me/founder/programs/:programId/sections/:sectionId/complete', ...gate, async (req: AuthRequest, res: Response) => {
  const resolved = await resolveAccessibleSection(req, Number(req.params.programId), Number(req.params.sectionId))
  if (resolved.error) { res.status(resolved.error.status).json({ error: resolved.error.message }); return }

  try {
    const saved = await markSectionComplete(resolved.tenantId, resolved.companyId, Number(req.params.sectionId))
    const feedbackForm = await checkProgramCompletionAndMaybeTriggerFeedback(resolved.tenantId, resolved.cohortId, resolved.companyId, Number(req.params.programId))
    res.json({ ...saved, feedbackForm })
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to mark section complete' })
  }
})

// ── Pillar materials (uploaded by any company-team member, visible to the whole team) ──

router.get('/tenants/me/founder/programs/:programId/pillars/:pillarId/materials', ...gate, async (req: AuthRequest, res: Response) => {
  const resolved = await resolveAccessiblePillar(req, Number(req.params.programId), Number(req.params.pillarId))
  if (resolved.error) { res.status(resolved.error.status).json({ error: resolved.error.message }); return }
  res.json(await listPillarMaterials(resolved.tenantId, resolved.companyId, Number(req.params.pillarId)))
})

router.get('/tenants/me/founder/programs/:programId/pillars/:pillarId/materials/:matId', ...gate, async (req: AuthRequest, res: Response) => {
  const resolved = await resolveAccessiblePillar(req, Number(req.params.programId), Number(req.params.pillarId))
  if (resolved.error) { res.status(resolved.error.status).json({ error: resolved.error.message }); return }
  const material = await getPillarMaterial(resolved.tenantId, Number(req.params.matId))
  if (!material || material.companyId !== resolved.companyId || material.pillarId !== Number(req.params.pillarId)) {
    res.status(404).json({ error: 'Material not found' })
    return
  }
  res.json(material)
})

const materialUploadSchema = z.object({
  title: z.string().min(1),
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  fileData: z.string().min(1),
  fileSize: z.number().int().positive(),
})

router.post('/tenants/me/founder/programs/:programId/pillars/:pillarId/materials', ...gate, async (req: AuthRequest, res: Response) => {
  const resolved = await resolveAccessiblePillar(req, Number(req.params.programId), Number(req.params.pillarId))
  if (resolved.error) { res.status(resolved.error.status).json({ error: resolved.error.message }); return }
  const parsed = materialUploadSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  if (parsed.data.fileSize > MAX_DOCUMENT_FILE_BYTES) { res.status(400).json({ error: 'File is too large — the limit is 8MB' }); return }
  try {
    res.json(await uploadPillarMaterial({ tenantId: resolved.tenantId, companyId: resolved.companyId, pillarId: Number(req.params.pillarId), uploadedByUserId: req.dbUser!.id, ...parsed.data }))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to upload material' })
  }
})

router.delete('/tenants/me/founder/programs/:programId/pillars/:pillarId/materials/:matId', ...gate, async (req: AuthRequest, res: Response) => {
  const resolved = await resolveAccessiblePillar(req, Number(req.params.programId), Number(req.params.pillarId))
  if (resolved.error) { res.status(resolved.error.status).json({ error: resolved.error.message }); return }
  try {
    await deletePillarMaterial(resolved.tenantId, Number(req.params.matId), req.dbUser!.id)
    res.json({ success: true })
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to delete material' })
  }
})

// ── Section materials (same access model, section-scoped instead of pillar-scoped) ──

router.get('/tenants/me/founder/programs/:programId/sections/:sectionId/materials', ...gate, async (req: AuthRequest, res: Response) => {
  const resolved = await resolveAccessibleSection(req, Number(req.params.programId), Number(req.params.sectionId))
  if (resolved.error) { res.status(resolved.error.status).json({ error: resolved.error.message }); return }
  res.json(await listSectionMaterials(resolved.tenantId, resolved.companyId, Number(req.params.sectionId)))
})

router.get('/tenants/me/founder/programs/:programId/sections/:sectionId/materials/:matId', ...gate, async (req: AuthRequest, res: Response) => {
  const resolved = await resolveAccessibleSection(req, Number(req.params.programId), Number(req.params.sectionId))
  if (resolved.error) { res.status(resolved.error.status).json({ error: resolved.error.message }); return }
  const material = await getSectionMaterial(resolved.tenantId, Number(req.params.matId))
  if (!material || material.companyId !== resolved.companyId || material.sectionId !== Number(req.params.sectionId)) {
    res.status(404).json({ error: 'Material not found' })
    return
  }
  res.json(material)
})

router.post('/tenants/me/founder/programs/:programId/sections/:sectionId/materials', ...gate, async (req: AuthRequest, res: Response) => {
  const resolved = await resolveAccessibleSection(req, Number(req.params.programId), Number(req.params.sectionId))
  if (resolved.error) { res.status(resolved.error.status).json({ error: resolved.error.message }); return }
  const parsed = materialUploadSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  if (parsed.data.fileSize > MAX_DOCUMENT_FILE_BYTES) { res.status(400).json({ error: 'File is too large — the limit is 8MB' }); return }
  try {
    res.json(await uploadSectionMaterial({ tenantId: resolved.tenantId, companyId: resolved.companyId, sectionId: Number(req.params.sectionId), uploadedByUserId: req.dbUser!.id, ...parsed.data }))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to upload material' })
  }
})

router.delete('/tenants/me/founder/programs/:programId/sections/:sectionId/materials/:matId', ...gate, async (req: AuthRequest, res: Response) => {
  const resolved = await resolveAccessibleSection(req, Number(req.params.programId), Number(req.params.sectionId))
  if (resolved.error) { res.status(resolved.error.status).json({ error: resolved.error.message }); return }
  try {
    await deleteSectionMaterial(resolved.tenantId, Number(req.params.matId), req.dbUser!.id)
    res.json({ success: true })
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to delete material' })
  }
})

// ── Key takeaways ────────────────────────────────────────────────────────────

router.get('/tenants/me/founder/programs/:programId/pillars/:pillarId/notes', ...gate, async (req: AuthRequest, res: Response) => {
  const resolved = await resolveAccessiblePillar(req, Number(req.params.programId), Number(req.params.pillarId))
  if (resolved.error) { res.status(resolved.error.status).json({ error: resolved.error.message }); return }
  res.json(await getPillarNote(resolved.tenantId, resolved.companyId, Number(req.params.pillarId)))
})

const notesSchema = z.object({ keyTakeaways: z.string() })

router.put('/tenants/me/founder/programs/:programId/pillars/:pillarId/notes', ...gate, async (req: AuthRequest, res: Response) => {
  const resolved = await resolveAccessiblePillar(req, Number(req.params.programId), Number(req.params.pillarId))
  if (resolved.error) { res.status(resolved.error.status).json({ error: resolved.error.message }); return }
  const parsed = notesSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  const note = await savePillarNote(resolved.tenantId, resolved.companyId, Number(req.params.pillarId), parsed.data.keyTakeaways)
  notifyMentorOfPillarSubmission({
    tenantId: resolved.tenantId,
    companyId: resolved.companyId,
    pillarId: Number(req.params.pillarId),
    authorUserId: req.dbUser!.id,
    type: 'takeaway',
    content: parsed.data.keyTakeaways,
  })
  res.json(note)
})

// ── Pillar discussion (visible to mentors — see mentor-programs.ts) ─────────

router.get('/tenants/me/founder/programs/:programId/pillars/:pillarId/comments', ...gate, async (req: AuthRequest, res: Response) => {
  const resolved = await resolveAccessiblePillar(req, Number(req.params.programId), Number(req.params.pillarId))
  if (resolved.error) { res.status(resolved.error.status).json({ error: resolved.error.message }); return }
  res.json(await listPillarComments(resolved.tenantId, resolved.companyId, Number(req.params.pillarId)))
})

const commentSchema = z.object({ body: z.string().min(1) })

router.post('/tenants/me/founder/programs/:programId/pillars/:pillarId/comments', ...gate, async (req: AuthRequest, res: Response) => {
  const resolved = await resolveAccessiblePillar(req, Number(req.params.programId), Number(req.params.pillarId))
  if (resolved.error) { res.status(resolved.error.status).json({ error: resolved.error.message }); return }
  const parsed = commentSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  const [firstMember] = await db
    .select({ userId: companyMembers.userId })
    .from(companyMembers)
    .where(eq(companyMembers.companyId, resolved.companyId))
    .orderBy(companyMembers.createdAt)
    .limit(1)

  const isCoFounder = firstMember && req.dbUser!.id !== firstMember.userId
  const role = isCoFounder ? 'co-founder' : 'founder'

  const comment = await addPillarComment({
    tenantId: resolved.tenantId,
    companyId: resolved.companyId,
    pillarId: Number(req.params.pillarId),
    authorUserId: req.dbUser!.id,
    authorRole: role,
    body: parsed.data.body,
  })
  notifyMentorOfPillarSubmission({
    tenantId: resolved.tenantId,
    companyId: resolved.companyId,
    pillarId: Number(req.params.pillarId),
    authorUserId: req.dbUser!.id,
    type: 'discussion',
    content: parsed.data.body,
  })
  res.json(comment)
})

// ── Readiness checklist ──────────────────────────────────────────────────────

router.get('/tenants/me/founder/programs/:programId/pillars/:pillarId/checklist', ...gate, async (req: AuthRequest, res: Response) => {
  const resolved = await resolveAccessiblePillar(req, Number(req.params.programId), Number(req.params.pillarId))
  if (resolved.error) { res.status(resolved.error.status).json({ error: resolved.error.message }); return }
  const questions = await db
    .select({ id: pillarChecklistQuestions.id, prompt: pillarChecklistQuestions.prompt, type: pillarChecklistQuestions.type, sortOrder: pillarChecklistQuestions.sortOrder })
    .from(pillarChecklistQuestions)
    .where(eq(pillarChecklistQuestions.pillarId, Number(req.params.pillarId)))
  questions.sort((a, b) => a.sortOrder - b.sortOrder)
  const answers = await getPillarChecklistResponses(resolved.tenantId, resolved.companyId, questions.map((q) => q.id))
  res.json({ questions, answers })
})

const checklistAnswersSchema = z.object({
  answers: z.array(z.object({ questionId: z.number().int(), answerText: z.string().nullable().optional(), answerBool: z.boolean().nullable().optional() })),
})

router.put('/tenants/me/founder/programs/:programId/pillars/:pillarId/checklist', ...gate, async (req: AuthRequest, res: Response) => {
  const resolved = await resolveAccessiblePillar(req, Number(req.params.programId), Number(req.params.pillarId))
  if (resolved.error) { res.status(resolved.error.status).json({ error: resolved.error.message }); return }
  const parsed = checklistAnswersSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  res.json(await savePillarChecklistResponses(resolved.tenantId, resolved.companyId, parsed.data.answers))
})

export default router
