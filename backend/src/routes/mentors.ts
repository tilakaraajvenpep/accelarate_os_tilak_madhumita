import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import { createMentorInvite, listMentorEntries, getMentorInviteDetails, acceptMentorInvite } from '../services/mentor-invites.service'
import {
  listEligibleMentors,
  getMentorProfile,
  setMentorSpecialization,
  getMentorOnboardingForm,
  setMentorOnboardingResponse,
  getInterestedInMentoring,
  setInterestedInMentoring,
} from '../services/mentors.service'
import { listMentorAssignments } from '../services/cohort-pillar-mentors.service'
import { listCohorts } from '../services/cohorts.service'
import { listCompanyEntries } from '../services/company-invites.service'
import { getCompanyFormAnswers } from '../services/founder-programs.service'
import { getSectionFormResponseDocument } from '../services/section-form-responses.service'

import { eq, and } from 'drizzle-orm'
import { db } from '../db/client'
import { users, cohortPillarMentors } from '../models'

const router = Router()

function tenantOf(req: AuthRequest, res: Response): number | null {
  const tenantId = req.dbUser!.tenantId
  if (!tenantId) {
    res.status(400).json({ error: 'No tenant associated with this account' })
    return null
  }
  return tenantId
}

// ── Admin + mentor: onboarding mentors ──────────────────────────────────────

const inviteSchema = z.object({ name: z.string().min(1), email: z.string().email() })

router.post('/tenants/me/mentor-invites', requireAuth, loadUser, requireRole('admin', 'mentor'), async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = inviteSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  try {
    const invite = await createMentorInvite({ tenantId, ...parsed.data })
    res.json({ id: invite.id, email: invite.email, name: invite.name, status: invite.status })
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to send invite' })
  }
})

router.get('/tenants/me/mentors', requireAuth, loadUser, requireRole('admin', 'mentor'), async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  res.json(await listMentorEntries(tenantId))
})

router.patch('/tenants/me/mentors/:id/status', requireAuth, loadUser, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const id = Number(req.params.id)
  const schema = z.object({ disabled: z.boolean() })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  try {
    const [updated] = await db
      .update(users)
      .set({ disabled: parsed.data.disabled, updatedAt: new Date() })
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId), eq(users.role, 'mentor')))
      .returning()
    if (!updated) { res.status(404).json({ error: 'Mentor not found' }); return }
    res.json({ id: updated.id, disabled: updated.disabled })
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update status' })
  }
})

router.get('/tenants/me/mentors/:id/assignments', requireAuth, loadUser, requireRole('admin', 'mentor'), async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const mentorUserId = Number(req.params.id)
  try {
    const assignments = await listMentorAssignments(tenantId, mentorUserId)
    res.json(assignments)
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to fetch assignments' })
  }
})

router.delete('/tenants/me/mentors/:id/cohorts/:cohortId', requireAuth, loadUser, requireRole('admin', 'mentor'), async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const mentorUserId = Number(req.params.id)
  const cohortId = Number(req.params.cohortId)
  try {
    const deleted = await db
      .delete(cohortPillarMentors)
      .where(
        and(
          eq(cohortPillarMentors.tenantId, tenantId),
          eq(cohortPillarMentors.cohortId, cohortId),
          eq(cohortPillarMentors.mentorUserId, mentorUserId)
        )
      )
      .returning()
    res.json({ success: true, count: deleted.length })
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to remove mentor from cohort' })
  }
})

router.get('/tenants/me/mentors/eligible', requireAuth, loadUser, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  res.json(await listEligibleMentors(tenantId))
})

// Public — the invitee isn't authenticated yet.
router.get('/mentor-invites/:token', async (req: Request, res: Response) => {
  const details = await getMentorInviteDetails(req.params.token)
  if (!details) { res.status(404).json({ error: 'This invite link is invalid or has expired' }); return }
  res.json(details)
})

const acceptSchema = z.object({ password: z.string().min(8) })

router.post('/mentor-invites/:token/accept', async (req: Request, res: Response) => {
  const parsed = acceptSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  try {
    res.json(await acceptMentorInvite(req.params.token, parsed.data.password))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to accept invite' })
  }
})

// ── Mentor's own profile / self-service ─────────────────────────────────────

router.get('/tenants/me/mentor-profile', requireAuth, loadUser, requireRole('mentor'), async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  res.json(await getMentorProfile(tenantId, req.dbUser!.id))
})

const specializationSchema = z.object({ specialization: z.string().min(1) })

router.patch('/tenants/me/mentor-profile', requireAuth, loadUser, requireRole('mentor'), async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = specializationSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  try {
    res.json(await setMentorSpecialization(tenantId, req.dbUser!.id, parsed.data.specialization))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save specialization' })
  }
})

// Whether a tenant-mapped 'mentor_onboarding' Assessment Form should replace the hardcoded specialization step above.
router.get('/tenants/me/mentor-onboarding-form', requireAuth, loadUser, requireRole('mentor'), async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  res.json(await getMentorOnboardingForm(tenantId))
})

const onboardingResponseSchema = z.object({
  templateId: z.number().int(),
  responseJson: z.record(z.string(), z.unknown()),
})

router.patch('/tenants/me/mentor-profile/onboarding-response', requireAuth, loadUser, requireRole('mentor'), async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = onboardingResponseSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  try {
    res.json(await setMentorOnboardingResponse(tenantId, req.dbUser!.id, parsed.data.templateId, parsed.data.responseJson))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save onboarding response' })
  }
})

router.get('/tenants/me/mentor-interest', requireAuth, loadUser, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  res.json(await getInterestedInMentoring(req.dbUser!.id))
})

const interestSchema = z.object({ interested: z.boolean() })

router.patch('/tenants/me/mentor-interest', requireAuth, loadUser, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const parsed = interestSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  try {
    res.json(await setInterestedInMentoring(req.dbUser!.id, parsed.data.interested))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update mentor interest' })
  }
})

// ── Mentor's dashboard views ─────────────────────────────────────────────────

router.get('/tenants/me/mentor/assignments', requireAuth, loadUser, requireRole('mentor'), async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  res.json(await listMentorAssignments(tenantId, req.dbUser!.id))
})

// Read-only — every cohort in the tenant, for a mentor to browse beyond their own assignments.
router.get('/tenants/me/mentor/cohorts', requireAuth, loadUser, requireRole('mentor'), async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  res.json(await listCohorts(tenantId))
})

// Companies in one of the mentor's own assigned cohorts — scoped so a mentor can't browse cohorts they aren't on.
router.get('/tenants/me/mentor/cohorts/:cohortId/companies', requireAuth, loadUser, requireRole('mentor'), async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const cohortId = Number(req.params.cohortId)
  const assignments = await listMentorAssignments(tenantId, req.dbUser!.id)
  if (!assignments.some((a) => a.cohortId === cohortId)) {
    res.status(403).json({ error: 'You are not assigned to this cohort' })
    return
  }
  res.json((await listCompanyEntries(tenantId, cohortId)).filter((c) => c.status === 'active'))
})

// A company's submitted form answers, limited to the pillars this mentor is assigned to on that cohort.
router.get('/tenants/me/mentor/cohorts/:cohortId/companies/:companyId/form-answers', requireAuth, loadUser, requireRole('mentor'), async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  try {
    res.json(await getCompanyFormAnswers(tenantId, Number(req.params.cohortId), Number(req.params.companyId), req.dbUser!.id))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to load form answers' })
  }
})

router.get(
  '/tenants/me/mentor/cohorts/:cohortId/companies/:companyId/sections/:sectionId/forms/:formId/document',
  requireAuth,
  loadUser,
  requireRole('mentor'),
  async (req: AuthRequest, res: Response) => {
    const tenantId = tenantOf(req, res)
    if (tenantId === null) return
    const branch = req.query.branch ? Number(req.query.branch) : undefined
    const doc = await getSectionFormResponseDocument(tenantId, Number(req.params.companyId), Number(req.params.sectionId), Number(req.params.formId), branch)
    if (!doc) { res.status(404).json({ error: 'Document not found' }); return }
    res.json(doc)
  },
)

export default router
