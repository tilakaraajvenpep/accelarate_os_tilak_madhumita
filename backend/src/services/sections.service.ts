import { eq, and, asc, max, inArray } from 'drizzle-orm'
import { db } from '../db/client'
import { sections, pillars, pillarSections, formTemplates, sectionForms } from '../models'
import { assertPillarEditable, assertSectionEditable } from './program-lock.helper'

async function attachForms<T extends { id: number }>(rows: T[]): Promise<(T & { forms: { id: number; name: string; fillPolicy: string }[] })[]> {
  if (rows.length === 0) return []

  const links = await db
    .select({ sectionId: sectionForms.sectionId, formId: formTemplates.id, formName: formTemplates.title, fillPolicy: sectionForms.fillPolicy })
    .from(sectionForms)
    .innerJoin(formTemplates, eq(sectionForms.formId, formTemplates.id))
    .where(inArray(sectionForms.sectionId, rows.map((r) => r.id)))

  const formsBySection = new Map<number, { id: number; name: string; fillPolicy: string }[]>()
  for (const link of links) {
    if (!formsBySection.has(link.sectionId)) formsBySection.set(link.sectionId, [])
    formsBySection.get(link.sectionId)!.push({ id: link.formId, name: link.formName, fillPolicy: link.fillPolicy })
  }

  return rows.map((row) => ({ ...row, forms: formsBySection.get(row.id) ?? [] }))
}

export async function listSections(tenantId: number) {
  const rows = await db
    .select({
      id: sections.id,
      title: sections.title,
      description: sections.description,
      status: sections.status,
      showInCalendar: sections.showInCalendar,
      locked: sections.locked,
      createdAt: sections.createdAt,
      updatedAt: sections.updatedAt,
    })
    .from(sections)
    .where(eq(sections.tenantId, tenantId))
    .orderBy(asc(sections.title))

  return attachForms(rows)
}

/** Section creation asks which pillar it belongs to and assigns it there immediately, appended to the end of that pillar's order. */
export async function createSection(params: {
  tenantId: number
  title: string
  description?: string | null
  status: 'active' | 'inactive'
  pillarId: number
  showInCalendar: boolean
}) {
  const [pillar] = await db.select().from(pillars).where(and(eq(pillars.id, params.pillarId), eq(pillars.tenantId, params.tenantId))).limit(1)
  if (!pillar) throw new Error('Pillar not found')
  await assertPillarEditable(params.tenantId, params.pillarId)

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(sections)
      .values({
        tenantId: params.tenantId,
        title: params.title,
        description: params.description ?? null,
        status: params.status,
        showInCalendar: params.showInCalendar,
      })
      .returning()

    const [{ value: maxOrder }] = await tx
      .select({ value: max(pillarSections.sortOrder) })
      .from(pillarSections)
      .where(eq(pillarSections.pillarId, params.pillarId))

    await tx.insert(pillarSections).values({ pillarId: params.pillarId, sectionId: created.id, sortOrder: (maxOrder ?? -1) + 1 })

    return created
  })
}

export async function updateSection(
  tenantId: number,
  id: number,
  data: Partial<{ title: string; description: string | null; status: 'active' | 'inactive'; showInCalendar: boolean; locked: boolean }>,
) {
  // `locked` is the unrelated founder-visibility toggle — everything else is structural and
  // stays blocked while any parent pillar's program is scheduled onto a cohort.
  const structuralKeys = Object.keys(data).filter((key) => key !== 'locked')
  if (structuralKeys.length > 0) await assertSectionEditable(tenantId, id)

  const [updated] = await db
    .update(sections)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(sections.id, id), eq(sections.tenantId, tenantId)))
    .returning()
  if (!updated) throw new Error('Section not found')
  return updated
}

export async function deleteSection(tenantId: number, id: number) {
  await assertSectionEditable(tenantId, id)
  return db.transaction(async (tx) => {
    await tx.delete(sectionForms).where(eq(sectionForms.sectionId, id))
    await tx.delete(pillarSections).where(eq(pillarSections.sectionId, id))
    const [deleted] = await tx.delete(sections).where(and(eq(sections.id, id), eq(sections.tenantId, tenantId))).returning()
    if (!deleted) throw new Error('Section not found')
    return deleted
  })
}

/** Replaces the full set of forms assigned to a section — a section can have any number of forms, including
 * none — each with its own fillPolicy ('primary_founder' | 'first_claim', see section_forms.fillPolicy). */
export async function setSectionForms(tenantId: number, sectionId: number, forms: { formId: number; fillPolicy: string }[]) {
  const [section] = await db.select().from(sections).where(and(eq(sections.id, sectionId), eq(sections.tenantId, tenantId))).limit(1)
  if (!section) throw new Error('Section not found')
  await assertSectionEditable(tenantId, sectionId)

  const formIds = forms.map((f) => f.formId)
  if (formIds.length > 0) {
    const validForms = await db
      .select({ id: formTemplates.id })
      .from(formTemplates)
      .where(and(inArray(formTemplates.id, formIds), eq(formTemplates.tenantId, tenantId)))
    if (validForms.length !== new Set(formIds).size) throw new Error('One or more forms were not found')
  }

  await db.transaction(async (tx) => {
    await tx.delete(sectionForms).where(eq(sectionForms.sectionId, sectionId))
    if (forms.length > 0) {
      await tx.insert(sectionForms).values(forms.map((f) => ({ sectionId, formId: f.formId, fillPolicy: f.fillPolicy })))
    }
  })

  const [{ forms: assignedForms }] = await attachForms([{ id: sectionId }])
  return assignedForms
}
