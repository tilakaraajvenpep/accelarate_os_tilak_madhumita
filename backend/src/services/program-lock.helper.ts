import { eq, and } from 'drizzle-orm'
import { db } from '../db/client'
import { cohortTasks, pillars, pillarSections } from '../models'

/** True once at least one cohort_tasks row references this program — i.e. an admin has scheduled it onto a cohort's calendar. */
export async function isProgramAssignedToCohort(tenantId: number, programId: number) {
  const [row] = await db
    .select({ id: cohortTasks.id })
    .from(cohortTasks)
    .where(and(eq(cohortTasks.tenantId, tenantId), eq(cohortTasks.programId, programId)))
    .limit(1)
  return !!row
}

/** Throws if the program is currently assigned to any cohort — editing its details/pillars/sections is blocked until it's released from every cohort. */
export async function assertProgramEditable(tenantId: number, programId: number) {
  if (await isProgramAssignedToCohort(tenantId, programId)) {
    throw new Error('This program is assigned to a cohort — release it from all its cohorts before editing it.')
  }
}

/** A pillar's own programId (if any) must not be cohort-assigned. */
export async function assertPillarEditable(tenantId: number, pillarId: number) {
  const [pillar] = await db.select({ programId: pillars.programId }).from(pillars).where(and(eq(pillars.id, pillarId), eq(pillars.tenantId, tenantId))).limit(1)
  if (!pillar || pillar.programId === null) return
  await assertProgramEditable(tenantId, pillar.programId)
}

/** A section can be linked to more than one pillar (possibly across programs) — locked if ANY parent program is cohort-assigned. */
export async function assertSectionEditable(tenantId: number, sectionId: number) {
  const parentPillars = await db
    .select({ programId: pillars.programId })
    .from(pillarSections)
    .innerJoin(pillars, eq(pillarSections.pillarId, pillars.id))
    .where(and(eq(pillarSections.sectionId, sectionId), eq(pillars.tenantId, tenantId)))

  const programIds = [...new Set(parentPillars.map((p) => p.programId).filter((id): id is number => id !== null))]
  for (const programId of programIds) {
    await assertProgramEditable(tenantId, programId)
  }
}
