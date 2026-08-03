import { eq, and, asc, max, inArray } from 'drizzle-orm'
import { db } from '../db/client'
import { pillars, programs, pillarSections, sections, formTemplates, sectionForms, pillarChecklistQuestions } from '../models'
import { assertProgramEditable, assertPillarEditable } from './program-lock.helper'

const PILLAR_COLUMNS = {
  id: pillars.id,
  title: pillars.title,
  description: pillars.description,
  programObjective: pillars.programObjective,
  phaseCoverage: pillars.phaseCoverage,
  expectedOutcomes: pillars.expectedOutcomes,
  founderExpectation: pillars.founderExpectation,
  programId: pillars.programId,
  programName: programs.name,
  sortOrder: pillars.sortOrder,
  parallelWithPrevious: pillars.parallelWithPrevious,
  status: pillars.status,
  purpose: pillars.purpose,
  passThreshold: pillars.passThreshold,
  mandatory: pillars.mandatory,
  showInCalendar: pillars.showInCalendar,
  locked: pillars.locked,
  hasReadinessChecklist: pillars.hasReadinessChecklist,
  hasKeyTakeawaysAndDiscussions: pillars.hasKeyTakeawaysAndDiscussions,
  createdAt: pillars.createdAt,
  updatedAt: pillars.updatedAt,
}

export async function listPillars(tenantId: number, programId?: number) {
  return db
    .select(PILLAR_COLUMNS)
    .from(pillars)
    .leftJoin(programs, eq(pillars.programId, programs.id))
    .where(programId === undefined ? eq(pillars.tenantId, tenantId) : and(eq(pillars.tenantId, tenantId), eq(pillars.programId, programId)))
    .orderBy(asc(pillars.sortOrder))
}

export async function getPillarById(tenantId: number, id: number) {
  const [pillar] = await db
    .select(PILLAR_COLUMNS)
    .from(pillars)
    .leftJoin(programs, eq(pillars.programId, programs.id))
    .where(and(eq(pillars.id, id), eq(pillars.tenantId, tenantId)))
    .limit(1)
  if (!pillar) return null

  const assignedSections = await db
    .select({
      pillarSectionId: pillarSections.id,
      sortOrder: pillarSections.sortOrder,
      sectionId: sections.id,
      title: sections.title,
      description: sections.description,
      status: sections.status,
      showInCalendar: sections.showInCalendar,
      locked: sections.locked,
    })
    .from(pillarSections)
    .innerJoin(sections, eq(pillarSections.sectionId, sections.id))
    .where(eq(pillarSections.pillarId, id))
    .orderBy(asc(pillarSections.sortOrder))

  const sectionIds = assignedSections.map((s) => s.sectionId)
  const formLinks =
    sectionIds.length === 0
      ? []
      : await db
          .select({ sectionId: sectionForms.sectionId, formId: formTemplates.id, formName: formTemplates.title, fillPolicy: sectionForms.fillPolicy })
          .from(sectionForms)
          .innerJoin(formTemplates, eq(sectionForms.formId, formTemplates.id))
          .where(inArray(sectionForms.sectionId, sectionIds))

  const formsBySection = new Map<number, { id: number; name: string; fillPolicy: string }[]>()
  for (const link of formLinks) {
    if (!formsBySection.has(link.sectionId)) formsBySection.set(link.sectionId, [])
    formsBySection.get(link.sectionId)!.push({ id: link.formId, name: link.formName, fillPolicy: link.fillPolicy })
  }

  const checklistQuestions = pillar.hasReadinessChecklist
    ? await db
        .select({ id: pillarChecklistQuestions.id, prompt: pillarChecklistQuestions.prompt, type: pillarChecklistQuestions.type, sortOrder: pillarChecklistQuestions.sortOrder })
        .from(pillarChecklistQuestions)
        .where(eq(pillarChecklistQuestions.pillarId, id))
        .orderBy(asc(pillarChecklistQuestions.sortOrder))
    : []

  return {
    ...pillar,
    sections: assignedSections.map((section) => ({ ...section, forms: formsBySection.get(section.sectionId) ?? [] })),
    checklistQuestions,
  }
}

/** Replaces every readiness-checklist question for a pillar in one go — simplest possible
 * authoring model; editing/removing a question after founders have answered drops their
 * answer for that question (no versioning), an accepted trade-off for this feature's scope. */
export async function replaceChecklistQuestions(tenantId: number, pillarId: number, questions: Array<{ prompt: string; type: 'text' | 'checkbox' }>) {
  await assertPillarEditable(tenantId, pillarId)
  return db.transaction(async (tx) => {
    await tx.delete(pillarChecklistQuestions).where(eq(pillarChecklistQuestions.pillarId, pillarId))
    if (questions.length === 0) return []
    return tx
      .insert(pillarChecklistQuestions)
      .values(questions.map((q, i) => ({ tenantId, pillarId, prompt: q.prompt, type: q.type, sortOrder: i })))
      .returning()
  })
}

export async function createPillar(params: {
  tenantId: number
  title: string
  description?: string | null
  programObjective: string
  phaseCoverage: string
  expectedOutcomes: string
  founderExpectation: string
  programId: number
  status: 'active' | 'inactive'
  purpose: 'learning' | 'assessment'
  passThreshold?: number | null
  mandatory: boolean
  showInCalendar: boolean
  hasReadinessChecklist?: boolean
  hasKeyTakeawaysAndDiscussions?: boolean
  // Create-time convenience — inserts right after this pillar instead of at
  // the end, by appending then reusing reorderPillars' resequencing logic.
  insertAfterPillarId?: number | null
}) {
  await assertProgramEditable(params.tenantId, params.programId)

  const [{ value: maxOrder }] = await db
    .select({ value: max(pillars.sortOrder) })
    .from(pillars)
    .where(and(eq(pillars.tenantId, params.tenantId), eq(pillars.programId, params.programId)))

  const [created] = await db
    .insert(pillars)
    .values({
      tenantId: params.tenantId,
      title: params.title,
      description: params.description ?? null,
      programObjective: params.programObjective,
      phaseCoverage: params.phaseCoverage,
      expectedOutcomes: params.expectedOutcomes,
      founderExpectation: params.founderExpectation,
      programId: params.programId,
      status: params.status,
      purpose: params.purpose,
      passThreshold: params.purpose === 'assessment' ? (params.passThreshold ?? null) : null,
      mandatory: params.mandatory,
      showInCalendar: params.showInCalendar,
      hasReadinessChecklist: params.hasReadinessChecklist ?? false,
      hasKeyTakeawaysAndDiscussions: params.hasKeyTakeawaysAndDiscussions ?? true,
      sortOrder: (maxOrder ?? -1) + 1,
    })
    .returning()

  if (params.insertAfterPillarId != null) {
    const existingOrder = await db
      .select({ id: pillars.id })
      .from(pillars)
      .where(and(eq(pillars.tenantId, params.tenantId), eq(pillars.programId, params.programId)))
      .orderBy(asc(pillars.sortOrder))
    const ids = existingOrder.map((p) => p.id).filter((id) => id !== created.id)
    const afterIndex = ids.indexOf(params.insertAfterPillarId)
    if (afterIndex !== -1) {
      ids.splice(afterIndex + 1, 0, created.id)
      await reorderPillars(params.tenantId, params.programId, ids)
      const [refreshed] = await db.select().from(pillars).where(eq(pillars.id, created.id)).limit(1)
      return refreshed ?? created
    }
  }

  return created
}

export async function updatePillar(
  tenantId: number,
  id: number,
  data: Partial<{
    title: string
    description: string | null
    programObjective: string | null
    phaseCoverage: string | null
    expectedOutcomes: string | null
    founderExpectation: string | null
    programId: number
    status: 'active' | 'inactive'
    purpose: 'learning' | 'assessment'
    passThreshold: number | null
    mandatory: boolean
    showInCalendar: boolean
    locked: boolean
    parallelWithPrevious: boolean
    hasReadinessChecklist: boolean
    hasKeyTakeawaysAndDiscussions: boolean
  }>,
) {
  // `locked` is the unrelated founder-visibility toggle — everything else is structural and
  // stays blocked while this pillar's program is scheduled onto a cohort.
  const structuralKeys = Object.keys(data).filter((key) => key !== 'locked')
  if (structuralKeys.length > 0) await assertPillarEditable(tenantId, id)
  if (data.programId !== undefined) await assertProgramEditable(tenantId, data.programId)

  if (data.parallelWithPrevious) {
    const [pillar] = await db.select({ sortOrder: pillars.sortOrder }).from(pillars).where(and(eq(pillars.id, id), eq(pillars.tenantId, tenantId))).limit(1)
    if (pillar && pillar.sortOrder === 0) {
      throw new Error("The first pillar can't run in parallel with a previous one — there isn't one.")
    }
  }

  const [updated] = await db
    .update(pillars)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(pillars.id, id), eq(pillars.tenantId, tenantId)))
    .returning()
  if (!updated) throw new Error('Pillar not found')
  return updated
}

export async function deletePillar(tenantId: number, id: number) {
  await assertPillarEditable(tenantId, id)
  return db.transaction(async (tx) => {
    await tx.delete(pillarSections).where(eq(pillarSections.pillarId, id))
    const [deleted] = await tx.delete(pillars).where(and(eq(pillars.id, id), eq(pillars.tenantId, tenantId))).returning()
    if (!deleted) throw new Error('Pillar not found')
    return deleted
  })
}

/** Drag-and-drop reorder — pillarIds is the full new top-to-bottom order within this program. */
export async function reorderPillars(tenantId: number, programId: number, pillarIds: number[]) {
  await assertProgramEditable(tenantId, programId)
  await db.transaction(async (tx) => {
    for (let i = 0; i < pillarIds.length; i++) {
      await tx
        .update(pillars)
        // The first pillar can't be "parallel with previous" — there's nothing before it.
        .set(i === 0 ? { sortOrder: i, parallelWithPrevious: false } : { sortOrder: i })
        .where(and(eq(pillars.tenantId, tenantId), eq(pillars.programId, programId), eq(pillars.id, pillarIds[i])))
    }
  })
}
