import { eq, and, ne, asc, max, ilike, inArray } from 'drizzle-orm'
import { db } from '../db/client'
import { programs, pillars, sections, pillarSections, sectionForms, cohorts, cohortTasks, cohortPillarMentors, pillarChecklistQuestions } from '../models'
import { assertProgramEditable } from './program-lock.helper'
import { setCohortPillarMentors } from './cohort-pillar-mentors.service'

async function listAssignedCohortsByProgram(tenantId: number, programId?: number) {
  const rows = await db
    .selectDistinct({ programId: cohortTasks.programId, cohortId: cohorts.id, cohortName: cohorts.name })
    .from(cohortTasks)
    .innerJoin(cohorts, eq(cohortTasks.cohortId, cohorts.id))
    .where(programId === undefined ? eq(cohortTasks.tenantId, tenantId) : and(eq(cohortTasks.tenantId, tenantId), eq(cohortTasks.programId, programId)))

  const cohortsByProgram = new Map<number, { id: number; name: string }[]>()
  for (const row of rows) {
    if (row.programId === null) continue
    if (!cohortsByProgram.has(row.programId)) cohortsByProgram.set(row.programId, [])
    cohortsByProgram.get(row.programId)!.push({ id: row.cohortId, name: row.cohortName })
  }
  return cohortsByProgram
}

export async function listPrograms(tenantId: number) {
  const [rows, cohortsByProgram] = await Promise.all([
    db.select().from(programs).where(eq(programs.tenantId, tenantId)).orderBy(asc(programs.sortOrder)),
    listAssignedCohortsByProgram(tenantId),
  ])
  return rows.map((program) => ({ ...program, assignedCohorts: cohortsByProgram.get(program.id) ?? [] }))
}

export async function getProgramById(tenantId: number, id: number) {
  const [program] = await db.select().from(programs).where(and(eq(programs.id, id), eq(programs.tenantId, tenantId))).limit(1)
  if (!program) return null
  const cohortsByProgram = await listAssignedCohortsByProgram(tenantId, id)
  return { ...program, assignedCohorts: cohortsByProgram.get(id) ?? [] }
}

async function assertNameAvailable(tenantId: number, name: string, excludeId?: number) {
  const [existing] = await db
    .select({ id: programs.id })
    .from(programs)
    .where(
      excludeId === undefined
        ? and(eq(programs.tenantId, tenantId), ilike(programs.name, name))
        : and(eq(programs.tenantId, tenantId), ilike(programs.name, name), ne(programs.id, excludeId)),
    )
    .limit(1)
  if (existing) throw new Error('A program with this name already exists')
}

export async function createProgram(params: {
  tenantId: number
  name: string
  description?: string | null
  status: 'active' | 'inactive'
}) {
  await assertNameAvailable(params.tenantId, params.name)

  const [{ value: maxOrder }] = await db
    .select({ value: max(programs.sortOrder) })
    .from(programs)
    .where(eq(programs.tenantId, params.tenantId))

  const [created] = await db
    .insert(programs)
    .values({
      tenantId: params.tenantId,
      name: params.name,
      description: params.description ?? null,
      status: params.status,
      sortOrder: (maxOrder ?? -1) + 1,
    })
    .returning()
  return created
}

export async function updateProgram(
  tenantId: number,
  id: number,
  data: Partial<{
    name: string
    description: string | null
    status: 'active' | 'inactive'
    locked: boolean
  }>,
) {
  if (data.name !== undefined || data.description !== undefined) await assertProgramEditable(tenantId, id)
  if (data.name !== undefined) await assertNameAvailable(tenantId, data.name, id)

  const [updated] = await db
    .update(programs)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(programs.id, id), eq(programs.tenantId, tenantId)))
    .returning()
  if (!updated) throw new Error('Program not found')
  return updated
}

export async function deleteProgram(tenantId: number, id: number) {
  const [program] = await db.select().from(programs).where(and(eq(programs.id, id), eq(programs.tenantId, tenantId))).limit(1)
  if (!program) throw new Error('Program not found')

  return db.transaction(async (tx) => {
    // 1. Remove all cohort_tasks rows (calendar entries) for this program across every cohort
    const programPillars = await tx
      .select({ id: pillars.id })
      .from(pillars)
      .where(and(eq(pillars.tenantId, tenantId), eq(pillars.programId, id)))

    const pillarIds = programPillars.map((p) => p.id)

    // Remove mentor assignments for all pillars of this program (across every cohort)
    if (pillarIds.length > 0) {
      await tx.delete(cohortPillarMentors).where(and(eq(cohortPillarMentors.tenantId, tenantId), inArray(cohortPillarMentors.pillarId, pillarIds)))
    }

    // Remove all cohort_tasks rows (calendar dates) for this program
    await tx.delete(cohortTasks).where(and(eq(cohortTasks.tenantId, tenantId), eq(cohortTasks.programId, id)))

    // 2. For each pillar, delete checklist questions and unlink sections
    for (const pillar of programPillars) {
      await tx.delete(pillarChecklistQuestions).where(eq(pillarChecklistQuestions.pillarId, pillar.id))

      const linkedSections = await tx
        .select({ sectionId: pillarSections.sectionId })
        .from(pillarSections)
        .where(eq(pillarSections.pillarId, pillar.id))

      const sectionIds = linkedSections.map((s) => s.sectionId)

      // Unlink sections from this pillar
      await tx.delete(pillarSections).where(eq(pillarSections.pillarId, pillar.id))

      // For sections that are now orphaned (not linked to any other pillar), remove them
      for (const sectionId of sectionIds) {
        const otherLinks = await tx
          .select({ id: pillarSections.id })
          .from(pillarSections)
          .where(eq(pillarSections.sectionId, sectionId))
          .limit(1)

        if (otherLinks.length === 0) {
          await tx.delete(sectionForms).where(eq(sectionForms.sectionId, sectionId))
          await tx.delete(sections).where(and(eq(sections.id, sectionId), eq(sections.tenantId, tenantId)))
        }
      }
    }

    // 3. Delete all pillars of this program
    if (pillarIds.length > 0) {
      await tx.delete(pillars).where(and(eq(pillars.tenantId, tenantId), eq(pillars.programId, id)))
    }

    // 4. Delete the program itself
    const [deleted] = await tx.delete(programs).where(and(eq(programs.id, id), eq(programs.tenantId, tenantId))).returning()
    if (!deleted) throw new Error('Program not found')
    return deleted
  })
}

/** Drag-and-drop reorder — programIds is the full new top-to-bottom order for this tenant. */
export async function reorderPrograms(tenantId: number, programIds: number[]) {
  await db.transaction(async (tx) => {
    for (let i = 0; i < programIds.length; i++) {
      await tx.update(programs).set({ sortOrder: i }).where(and(eq(programs.tenantId, tenantId), eq(programs.id, programIds[i])))
    }
  })
}

/**
 * The pillars/sections of this program that are calendar-enabled — what a
 * "assign to cohort" dialog needs to render one date field per item.
 */
export async function listCalendarItemsForProgram(tenantId: number, programId: number) {
  const [program] = await db.select().from(programs).where(and(eq(programs.id, programId), eq(programs.tenantId, tenantId))).limit(1)
  if (!program) throw new Error('Program not found')

  const calendarPillars = await db
    .select({ id: pillars.id, title: pillars.title })
    .from(pillars)
    .where(and(eq(pillars.tenantId, tenantId), eq(pillars.programId, programId), eq(pillars.showInCalendar, true)))
    .orderBy(asc(pillars.sortOrder))

  const allPillarIds = (
    await db.select({ id: pillars.id }).from(pillars).where(and(eq(pillars.tenantId, tenantId), eq(pillars.programId, programId)))
  ).map((p) => p.id)

  const calendarSections =
    allPillarIds.length === 0
      ? []
      : await db
          .selectDistinct({ id: sections.id, title: sections.title })
          .from(pillarSections)
          .innerJoin(sections, eq(pillarSections.sectionId, sections.id))
          .where(and(inArray(pillarSections.pillarId, allPillarIds), eq(sections.showInCalendar, true)))

  return { pillars: calendarPillars, sections: calendarSections }
}

/**
 * Schedules a program onto a cohort — one cohort_tasks row per calendar-
 * enabled pillar/section, dated if the admin picked a date for it (a date is
 * optional; an unfilled one is just left null). A program can have zero
 * calendar-enabled pillars/sections — there's nothing to date in that case,
 * but it still needs one placeholder row (programId set, no pillar/section,
 * no date) since a cohort_tasks row referencing the program is what makes it
 * visible to founders at all (see listAssignedProgramsForCompany) — there's
 * no separate "enrollment" table.
 */
export async function assignProgramToCohort(params: {
  tenantId: number
  programId: number
  cohortId: number
  items: Array<{ type: 'pillar' | 'section'; id: number; date: string | null }>
  createdByUserId: number
  // One mentor per pillar for this cohort — covers every company in it (see cohort-pillar-mentors.service.ts).
  pillarMentors?: Array<{ pillarId: number; mentorUserId: number }>
}) {
  const [program] = await db.select().from(programs).where(and(eq(programs.id, params.programId), eq(programs.tenantId, params.tenantId))).limit(1)
  if (!program) throw new Error('Program not found')

  const [cohort] = await db.select().from(cohorts).where(and(eq(cohorts.id, params.cohortId), eq(cohorts.tenantId, params.tenantId))).limit(1)
  if (!cohort) throw new Error('Cohort not found')

  const { pillars: calendarPillars, sections: calendarSections } = await listCalendarItemsForProgram(params.tenantId, params.programId)
  const pillarById = new Map(calendarPillars.map((p) => [p.id, p]))
  const sectionById = new Map(calendarSections.map((s) => [s.id, s]))

  const rows =
    params.items.length > 0
      ? params.items.map((item) => {
          if (item.type === 'pillar') {
            const pillar = pillarById.get(item.id)
            if (!pillar) throw new Error('One or more pillars are not calendar-enabled for this program')
            return {
              tenantId: params.tenantId,
              cohortId: params.cohortId,
              programId: params.programId,
              pillarId: pillar.id,
              title: pillar.title,
              startDate: item.date,
              createdByUserId: params.createdByUserId,
            }
          }
          const section = sectionById.get(item.id)
          if (!section) throw new Error('One or more sections are not calendar-enabled for this program')
          return {
            tenantId: params.tenantId,
            cohortId: params.cohortId,
            programId: params.programId,
            sectionId: section.id,
            title: section.title,
            startDate: item.date,
            createdByUserId: params.createdByUserId,
          }
        })
      : [
          {
            tenantId: params.tenantId,
            cohortId: params.cohortId,
            programId: params.programId,
            title: program.name,
            startDate: null,
            createdByUserId: params.createdByUserId,
          },
        ]

  const created = await db.insert(cohortTasks).values(rows).returning()

  if (params.pillarMentors && params.pillarMentors.length > 0) {
    const validPillarIds = new Set(calendarPillars.map((p) => p.id))
    for (const assignment of params.pillarMentors) {
      if (!validPillarIds.has(assignment.pillarId)) throw new Error('One or more mentor assignments reference a pillar not in this program')
    }
    await setCohortPillarMentors(params.tenantId, params.cohortId, params.pillarMentors)
  }

  return created
}

/**
 * Releases a program from a cohort:
 * 1. Removes every cohort_tasks row (calendar dates) for this program on that cohort.
 * 2. Removes every cohort_pillar_mentors row for pillars of this program on that cohort.
 */
export async function releaseProgramFromCohort(tenantId: number, programId: number, cohortId: number) {
  // Find all pillar IDs belonging to this program so we can remove their mentor assignments
  const programPillars = await db
    .select({ id: pillars.id })
    .from(pillars)
    .where(and(eq(pillars.tenantId, tenantId), eq(pillars.programId, programId)))

  const pillarIds = programPillars.map((p) => p.id)

  return db.transaction(async (tx) => {
    // Remove mentor assignments for the pillars of this program scoped to this cohort
    if (pillarIds.length > 0) {
      await tx
        .delete(cohortPillarMentors)
        .where(
          and(
            eq(cohortPillarMentors.tenantId, tenantId),
            eq(cohortPillarMentors.cohortId, cohortId),
            inArray(cohortPillarMentors.pillarId, pillarIds),
          ),
        )
    }

    // Remove the cohort_tasks rows (calendar dates)
    const deleted = await tx
      .delete(cohortTasks)
      .where(and(eq(cohortTasks.tenantId, tenantId), eq(cohortTasks.programId, programId), eq(cohortTasks.cohortId, cohortId)))
      .returning()

    if (deleted.length === 0) throw new Error('This program is not assigned to that cohort')
    return { released: deleted.length }
  })
}

/** Deep-copies a program with all its pillars, sections and form assignments under a new name. */
export async function duplicateProgram(tenantId: number, programId: number, newName: string) {
  const [source] = await db.select().from(programs).where(and(eq(programs.id, programId), eq(programs.tenantId, tenantId))).limit(1)
  if (!source) throw new Error('Program not found')
  await assertNameAvailable(tenantId, newName)

  return db.transaction(async (tx) => {
    const [{ value: maxOrder }] = await tx.select({ value: max(programs.sortOrder) }).from(programs).where(eq(programs.tenantId, tenantId))

    const [newProgram] = await tx
      .insert(programs)
      .values({
        tenantId,
        name: newName,
        description: source.description,
        status: source.status,
        sortOrder: (maxOrder ?? -1) + 1,
        locked: false,
      })
      .returning()

    const sourcePillars = await tx
      .select()
      .from(pillars)
      .where(and(eq(pillars.tenantId, tenantId), eq(pillars.programId, programId)))
      .orderBy(asc(pillars.sortOrder))

    for (const sourcePillar of sourcePillars) {
      const [newPillar] = await tx
        .insert(pillars)
        .values({
          tenantId,
          title: sourcePillar.title,
          description: sourcePillar.description,
          programObjective: sourcePillar.programObjective,
          phaseCoverage: sourcePillar.phaseCoverage,
          expectedOutcomes: sourcePillar.expectedOutcomes,
          founderExpectation: sourcePillar.founderExpectation,
          programId: newProgram.id,
          sortOrder: sourcePillar.sortOrder,
          parallelWithPrevious: sourcePillar.parallelWithPrevious,
          status: sourcePillar.status,
          showInCalendar: sourcePillar.showInCalendar,
          locked: false,
        })
        .returning()

      const sourceLinks = await tx
        .select({ sectionId: pillarSections.sectionId, sortOrder: pillarSections.sortOrder })
        .from(pillarSections)
        .where(eq(pillarSections.pillarId, sourcePillar.id))
        .orderBy(asc(pillarSections.sortOrder))

      for (const link of sourceLinks) {
        const [sourceSection] = await tx.select().from(sections).where(eq(sections.id, link.sectionId)).limit(1)
        if (!sourceSection) continue

        const [newSection] = await tx
          .insert(sections)
          .values({
            tenantId,
            title: sourceSection.title,
            description: sourceSection.description,
            status: sourceSection.status,
            showInCalendar: sourceSection.showInCalendar,
            locked: false,
          })
          .returning()

        await tx.insert(pillarSections).values({ pillarId: newPillar.id, sectionId: newSection.id, sortOrder: link.sortOrder })

        const formLinks = await tx.select({ formId: sectionForms.formId }).from(sectionForms).where(eq(sectionForms.sectionId, sourceSection.id))
        if (formLinks.length > 0) {
          await tx.insert(sectionForms).values(formLinks.map((f) => ({ sectionId: newSection.id, formId: f.formId })))
        }
      }
    }

    return newProgram
  })
}
