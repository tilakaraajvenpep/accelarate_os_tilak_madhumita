import { Router, Response } from 'express'
import { z } from 'zod'
import { requireAuth, loadUser, requireRole, type AuthRequest } from '../middleware/auth.middleware'
import { listPillars, getPillarById, createPillar, updatePillar, deletePillar, reorderPillars, replaceChecklistQuestions } from '../services/pillars.service'
import { listSections, createSection, updateSection, deleteSection, setSectionForms } from '../services/sections.service'
import { assignSectionToPillar, reorderPillarSections, unassignSectionFromPillar } from '../services/pillar-sections.service'
import {
  listPrograms,
  getProgramById,
  createProgram,
  updateProgram,
  deleteProgram,
  reorderPrograms,
  listCalendarItemsForProgram,
  assignProgramToCohort,
  releaseProgramFromCohort,
  duplicateProgram,
} from '../services/programs.service'

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

// ── Programs ────────────────────────────────────────────────────────────────

router.get('/tenants/me/programs', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  res.json(await listPrograms(tenantId))
})

router.get('/tenants/me/programs/:id', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const program = await getProgramById(tenantId, Number(req.params.id))
  if (!program) { res.status(404).json({ error: 'Program not found' }); return }
  res.json(program)
})

const programSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  status: z.enum(['active', 'inactive']),
})
const programUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  locked: z.boolean().optional(),
})

router.post('/tenants/me/programs', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = programSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  try {
    res.json(await createProgram({ tenantId, ...parsed.data }))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create program' })
  }
})

const reorderProgramsSchema = z.object({ programIds: z.array(z.number().int()) })

router.patch('/tenants/me/programs/reorder', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = reorderProgramsSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  try {
    await reorderPrograms(tenantId, parsed.data.programIds)
    res.json({ message: 'Reordered' })
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to reorder programs' })
  }
})

router.patch('/tenants/me/programs/:id', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = programUpdateSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  try {
    res.json(await updateProgram(tenantId, Number(req.params.id), parsed.data))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update program' })
  }
})

router.delete('/tenants/me/programs/:id', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  try {
    res.json(await deleteProgram(tenantId, Number(req.params.id)))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to delete program' })
  }
})

router.get('/tenants/me/programs/:id/calendar-items', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  try {
    res.json(await listCalendarItemsForProgram(tenantId, Number(req.params.id)))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to load calendar items' })
  }
})

const assignProgramSchema = z.object({
  cohortId: z.number().int(),
  // Empty is valid — a program with no calendar-enabled pillars/sections has
  // nothing to date, and a date per item is just optional (see
  // assignProgramToCohort in programs.service.ts).
  items: z.array(z.object({ type: z.enum(['pillar', 'section']), id: z.number().int(), date: z.string().min(1).nullable() })),
  pillarMentors: z.array(z.object({ pillarId: z.number().int(), mentorUserId: z.number().int() })).optional(),
})

router.post('/tenants/me/programs/:id/assign-to-cohort', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = assignProgramSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  try {
    res.json(
      await assignProgramToCohort({
        tenantId,
        programId: Number(req.params.id),
        cohortId: parsed.data.cohortId,
        items: parsed.data.items,
        pillarMentors: parsed.data.pillarMentors,
        createdByUserId: req.dbUser!.id,
      }),
    )
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to assign program to cohort' })
  }
})

router.delete('/tenants/me/programs/:id/assign-to-cohort/:cohortId', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  try {
    res.json(await releaseProgramFromCohort(tenantId, Number(req.params.id), Number(req.params.cohortId)))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to release program from cohort' })
  }
})

const duplicateProgramSchema = z.object({ name: z.string().min(1) })

router.post('/tenants/me/programs/:id/duplicate', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = duplicateProgramSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  try {
    res.json(await duplicateProgram(tenantId, Number(req.params.id), parsed.data.name))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to duplicate program' })
  }
})

// ── Pillars ─────────────────────────────────────────────────────────────────

router.get('/tenants/me/pillars', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const programId = typeof req.query.programId === 'string' ? Number(req.query.programId) : undefined
  res.json(await listPillars(tenantId, programId))
})

router.get('/tenants/me/pillars/:id', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const pillar = await getPillarById(tenantId, Number(req.params.id))
  if (!pillar) { res.status(404).json({ error: 'Pillar not found' }); return }
  res.json(pillar)
})

const pillarSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  programObjective: z.string().min(1),
  phaseCoverage: z.string().min(1),
  expectedOutcomes: z.string().min(1),
  founderExpectation: z.string().min(1),
  programId: z.number().int(),
  status: z.enum(['active', 'inactive']),
  purpose: z.enum(['learning', 'assessment']).default('learning'),
  // Optional even for an assessment pillar — see pillar.model.ts.
  passThreshold: z.number().int().min(0).max(100).nullable().optional(),
  mandatory: z.boolean().default(true),
  showInCalendar: z.boolean().default(false),
  hasReadinessChecklist: z.boolean().default(false),
  hasKeyTakeawaysAndDiscussions: z.boolean().default(true),
  insertAfterPillarId: z.number().int().nullable().optional(),
})
const pillarUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  programObjective: z.string().nullable().optional(),
  phaseCoverage: z.string().nullable().optional(),
  expectedOutcomes: z.string().nullable().optional(),
  founderExpectation: z.string().nullable().optional(),
  programId: z.number().int().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  purpose: z.enum(['learning', 'assessment']).optional(),
  passThreshold: z.number().int().min(0).max(100).nullable().optional(),
  mandatory: z.boolean().optional(),
  showInCalendar: z.boolean().optional(),
  locked: z.boolean().optional(),
  parallelWithPrevious: z.boolean().optional(),
  hasReadinessChecklist: z.boolean().optional(),
  hasKeyTakeawaysAndDiscussions: z.boolean().optional(),
})

router.post('/tenants/me/pillars', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = pillarSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  try {
    res.json(await createPillar({ tenantId, ...parsed.data }))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create pillar' })
  }
})

const reorderPillarsSchema = z.object({
  programId: z.number().int(),
  pillarIds: z.array(z.number().int()),
})

router.patch('/tenants/me/pillars/reorder', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = reorderPillarsSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  try {
    await reorderPillars(tenantId, parsed.data.programId, parsed.data.pillarIds)
    res.json({ message: 'Reordered' })
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to reorder pillars' })
  }
})

router.patch('/tenants/me/pillars/:id', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = pillarUpdateSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  try {
    res.json(await updatePillar(tenantId, Number(req.params.id), parsed.data))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update pillar' })
  }
})

router.delete('/tenants/me/pillars/:id', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  try {
    res.json(await deletePillar(tenantId, Number(req.params.id)))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to delete pillar' })
  }
})

const checklistQuestionsSchema = z.object({
  questions: z.array(z.object({ prompt: z.string().min(1), type: z.enum(['text', 'checkbox']) })),
})

router.put('/tenants/me/pillars/:id/checklist-questions', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = checklistQuestionsSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  try {
    res.json(await replaceChecklistQuestions(tenantId, Number(req.params.id), parsed.data.questions))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save checklist questions' })
  }
})

// ── Sections ────────────────────────────────────────────────────────────────

router.get('/tenants/me/sections', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  res.json(await listSections(tenantId))
})

const sectionSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  status: z.enum(['active', 'inactive']),
  pillarId: z.number().int(),
  showInCalendar: z.boolean().default(false),
})
const sectionUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  pillarId: z.number().int().optional(),
  showInCalendar: z.boolean().optional(),
  locked: z.boolean().optional(),
})

router.post('/tenants/me/sections', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = sectionSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  try {
    res.json(await createSection({ tenantId, ...parsed.data }))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create section' })
  }
})

router.patch('/tenants/me/sections/:id', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = sectionUpdateSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  try {
    res.json(await updateSection(tenantId, Number(req.params.id), parsed.data))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update section' })
  }
})

router.delete('/tenants/me/sections/:id', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  try {
    res.json(await deleteSection(tenantId, Number(req.params.id)))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to delete section' })
  }
})

const sectionFormsSchema = z.object({
  forms: z.array(z.object({ formId: z.number().int(), fillPolicy: z.enum(['primary_founder', 'first_claim']) })),
})

router.patch('/tenants/me/sections/:id/forms', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = sectionFormsSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  try {
    res.json(await setSectionForms(tenantId, Number(req.params.id), parsed.data.forms))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to assign forms' })
  }
})

// ── Section Mapping (assign sections to a pillar + drag-and-drop order) ─────

const mapSchema = z.object({ sectionId: z.number().int() })

router.post('/tenants/me/pillars/:id/sections', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = mapSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  try {
    res.json(await assignSectionToPillar(tenantId, Number(req.params.id), parsed.data.sectionId))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to assign section' })
  }
})

const reorderSchema = z.object({ sectionIds: z.array(z.number().int()) })

router.patch('/tenants/me/pillars/:id/sections/reorder', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  const parsed = reorderSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  try {
    await reorderPillarSections(tenantId, Number(req.params.id), parsed.data.sectionIds)
    res.json({ message: 'Reordered' })
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to reorder sections' })
  }
})

router.delete('/tenants/me/pillars/:id/sections/:sectionId', ...gate, async (req: AuthRequest, res: Response) => {
  const tenantId = tenantOf(req, res)
  if (tenantId === null) return
  try {
    res.json(await unassignSectionFromPillar(tenantId, Number(req.params.id), Number(req.params.sectionId)))
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to unassign section' })
  }
})

export default router
