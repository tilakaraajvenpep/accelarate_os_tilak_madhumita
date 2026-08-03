import { Router, Response } from 'express'
import { z } from 'zod'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import { listCohorts, getCohortById, createCohort, updateCohort, deleteCohort } from '../services/cohorts.service'
import { getCompanyProgressForCohort, getCompanyFormAnswers } from '../services/founder-programs.service'
import { listCohortForms, attachFormToCohort, detachFormFromCohort } from '../services/cohort-forms.service'
import { listCohortPillarMentors, listScheduledPillarsForCohort, setCohortPillarMentors } from '../services/cohort-pillar-mentors.service'
import { getSectionFormResponseDocument } from '../services/section-form-responses.service'
import { listCompanyUnlocks, setCompanyUnlock } from '../services/company-unlocks.service'

const router = Router()

function tenantOf(req: AuthRequest, res: Response): number | null {
  const tenantId = req.dbUser!.tenantId
  if (!tenantId) {
    res.status(400).json({ error: 'No tenant associated with this account' })
    return null
  }
  return tenantId
}

const gate = [requireAuth, loadUser, requireRole('admin')] as const

router.get('/tenants/me/cohorts', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  res.json(await listCohorts(tenantId))
})

router.get('/tenants/me/cohorts/:id', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const cohort = await getCohortById(tenantId, Number(req.params.id))
  if (!cohort) { res.status(404).json({ error: 'Cohort not found' }); return }
  res.json(cohort)
})

const cohortSchema = z.object({
  name: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
})
const cohortUpdateSchema = cohortSchema.partial()

router.post('/tenants/me/cohorts', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = cohortSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  if (parsed.data.endDate < parsed.data.startDate) {
    res.status(400).json({ error: 'End date must be on or after the start date' })
    return
  }
  try {
    res.json(await createCohort({ tenantId, ...parsed.data }))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create cohort' })
  }
})

router.patch('/tenants/me/cohorts/:id', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = cohortUpdateSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  if (parsed.data.startDate && parsed.data.endDate && parsed.data.endDate < parsed.data.startDate) {
    res.status(400).json({ error: 'End date must be on or after the start date' })
    return
  }
  try {
    res.json(await updateCohort(tenantId, Number(req.params.id), parsed.data))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update cohort' })
  }
})

router.get('/tenants/me/cohorts/:id/company-progress', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  try {
    res.json(await getCompanyProgressForCohort(tenantId, Number(req.params.id)))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to load company progress' })
  }
})

router.get('/tenants/me/cohorts/:id/companies/:companyId/form-answers', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  try {
    res.json(await getCompanyFormAnswers(tenantId, Number(req.params.id), Number(req.params.companyId)))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to load form answers' })
  }
})

router.get(
  '/tenants/me/cohorts/:id/companies/:companyId/sections/:sectionId/forms/:formId/document',
  ...gate,
  async (req: AuthRequest, res: Response) => {
    const tenantId = tenantOf(req, res)
    if (tenantId === null) return
    const doc = await getSectionFormResponseDocument(tenantId, Number(req.params.companyId), Number(req.params.sectionId), Number(req.params.formId))
    if (!doc) { res.status(404).json({ error: 'Document not found' }); return }
    res.json(doc)
  },
)

router.get('/tenants/me/cohorts/:id/forms', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  res.json(await listCohortForms(tenantId, Number(req.params.id)))
})

const attachCohortFormSchema = z.object({
  formId: z.number().int(),
  fillPolicy: z.enum(['primary_founder', 'first_claim']),
})

router.post('/tenants/me/cohorts/:id/forms', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = attachCohortFormSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  try {
    res.json(await attachFormToCohort(tenantId, Number(req.params.id), parsed.data.formId, parsed.data.fillPolicy))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to attach form to cohort' })
  }
})

router.delete('/tenants/me/cohorts/:id/forms/:formId', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  try {
    res.json(await detachFormFromCohort(tenantId, Number(req.params.id), Number(req.params.formId)))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to detach form from cohort' })
  }
})

router.get('/tenants/me/cohorts/:id/pillar-mentors', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  res.json(await listCohortPillarMentors(tenantId, Number(req.params.id)))
})

router.get('/tenants/me/cohorts/:id/scheduled-pillars', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  res.json(await listScheduledPillarsForCohort(tenantId, Number(req.params.id)))
})

const pillarMentorsSchema = z.object({
  assignments: z.array(z.object({ pillarId: z.number().int().nullable(), mentorUserId: z.number().int() })),
})

router.put('/tenants/me/cohorts/:id/pillar-mentors', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = pillarMentorsSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  try {
    await setCohortPillarMentors(tenantId, Number(req.params.id), parsed.data.assignments)
    res.json(await listCohortPillarMentors(tenantId, Number(req.params.id)))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to assign mentors' })
  }
})

router.delete('/tenants/me/cohorts/:id', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  try {
    res.json(await deleteCohort(tenantId, Number(req.params.id)))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to delete cohort' })
  }
})

router.get('/tenants/me/cohorts/:id/companies/:companyId/unlocks', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  res.json(await listCompanyUnlocks(tenantId, Number(req.params.companyId)))
})

const setUnlockSchema = z.object({
  pillarId: z.number().int().nullable(),
  sectionId: z.number().int().nullable(),
  unlocked: z.boolean(),
})

router.post('/tenants/me/cohorts/:id/companies/:companyId/unlocks', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = setUnlockSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  try {
    await setCompanyUnlock(tenantId, Number(req.params.companyId), parsed.data.pillarId, parsed.data.sectionId, parsed.data.unlocked)
    res.json({ success: true })
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to toggle unlock' })
  }
})

export default router
