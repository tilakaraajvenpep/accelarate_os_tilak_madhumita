import { eq, and, max } from 'drizzle-orm'
import { db } from '../db/client'
import { pillars, sections, pillarSections } from '../models'
import { assertProgramEditable } from './program-lock.helper'

async function assertOwnership(tenantId: number, pillarId: number, sectionId?: number) {
  const [pillar] = await db.select().from(pillars).where(and(eq(pillars.id, pillarId), eq(pillars.tenantId, tenantId))).limit(1)
  if (!pillar) throw new Error('Pillar not found')
  if (sectionId !== undefined) {
    const [section] = await db.select().from(sections).where(and(eq(sections.id, sectionId), eq(sections.tenantId, tenantId))).limit(1)
    if (!section) throw new Error('Section not found')
  }
  if (pillar.programId !== null) await assertProgramEditable(tenantId, pillar.programId)
}

/** Section Mapping — assigns a section to a pillar, appended at the end of its current order. */
export async function assignSectionToPillar(tenantId: number, pillarId: number, sectionId: number) {
  await assertOwnership(tenantId, pillarId, sectionId)

  const [existing] = await db
    .select()
    .from(pillarSections)
    .where(and(eq(pillarSections.pillarId, pillarId), eq(pillarSections.sectionId, sectionId)))
    .limit(1)
  if (existing) return existing

  const [{ value: maxOrder }] = await db
    .select({ value: max(pillarSections.sortOrder) })
    .from(pillarSections)
    .where(eq(pillarSections.pillarId, pillarId))

  const [created] = await db
    .insert(pillarSections)
    .values({ pillarId, sectionId, sortOrder: (maxOrder ?? -1) + 1 })
    .returning()
  return created
}

/** Drag-and-drop reorder — sectionIds is the full new top-to-bottom order for this pillar. */
export async function reorderPillarSections(tenantId: number, pillarId: number, sectionIds: number[]) {
  await assertOwnership(tenantId, pillarId)

  await db.transaction(async (tx) => {
    for (let i = 0; i < sectionIds.length; i++) {
      await tx
        .update(pillarSections)
        .set({ sortOrder: i })
        .where(and(eq(pillarSections.pillarId, pillarId), eq(pillarSections.sectionId, sectionIds[i])))
    }
  })
}

export async function unassignSectionFromPillar(tenantId: number, pillarId: number, sectionId: number) {
  await assertOwnership(tenantId, pillarId, sectionId)
  const [deleted] = await db
    .delete(pillarSections)
    .where(and(eq(pillarSections.pillarId, pillarId), eq(pillarSections.sectionId, sectionId)))
    .returning()
  if (!deleted) throw new Error('This section is not assigned to this pillar')
  return deleted
}
