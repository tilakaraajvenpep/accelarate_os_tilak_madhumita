import { eq, and } from 'drizzle-orm'
import { db } from '../db/client'
import { formMappings, formTemplates, formResponses, companyPillars, pillarDefinitions, companies } from '../models'

/** The dynamic "how many pillars exist" source of truth — whatever distinct
 * numeric contextId values exist among a tenant's active pillar_diagnostic
 * mappings. No hardcoded pillar list anywhere. */
export async function getDistinctPillarNumbers(tenantId: number): Promise<number[]> {
  const rows = await db
    .selectDistinct({ contextId: formMappings.contextId })
    .from(formMappings)
    .where(and(eq(formMappings.tenantId, tenantId), eq(formMappings.type, 'pillar_diagnostic'), eq(formMappings.isActive, true)))

  const numbers = rows.map((r) => parseInt(r.contextId, 10)).filter((n) => !isNaN(n))
  return Array.from(new Set(numbers)).sort((a, b) => a - b)
}

export async function listPillarsForCompany(tenantId: number, companyId: number) {
  const numbers = await getDistinctPillarNumbers(tenantId)
  if (numbers.length === 0) return []

  const [existingRows, defRows] = await Promise.all([
    db.select().from(companyPillars).where(eq(companyPillars.companyId, companyId)),
    db.select().from(pillarDefinitions).where(eq(pillarDefinitions.tenantId, tenantId)),
  ])
  const existingByNumber = new Map(existingRows.map((p) => [p.pillarNumber, p]))
  const titleByNumber = new Map(defRows.map((d) => [d.pillarNumber, d.title]))

  const result = []
  for (const n of numbers) {
    let row = existingByNumber.get(n)
    if (!row) {
      const status = n === 1 || n === numbers[0] ? 'unlocked' : 'locked'
      ;[row] = await db.insert(companyPillars).values({ tenantId, companyId, pillarNumber: n, status }).returning()
    }
    result.push({
      pillarNumber: n,
      title: titleByNumber.get(n) || `Pillar ${n}`,
      status: row.status,
      completionPercentage: row.completionPercentage,
    })
  }
  return result
}

/** Best-effort side effect after a response save — never throws, matching the
 * reference system's non-blocking pillar-completion behavior. */
export async function recalculatePillarCompletion(tenantId: number, companyId: number, pillarNumber: number) {
  const [company] = await db.select({ cohortId: companies.cohortId }).from(companies).where(eq(companies.id, companyId)).limit(1)
  const cohortId = company?.cohortId ?? null

  const allMappings = await db
    .select({ mapping: formMappings })
    .from(formMappings)
    .innerJoin(formTemplates, eq(formMappings.templateId, formTemplates.id))
    .where(
      and(
        eq(formMappings.tenantId, tenantId),
        eq(formMappings.type, 'pillar_diagnostic'),
        eq(formMappings.contextId, String(pillarNumber)),
        eq(formMappings.isActive, true),
        eq(formTemplates.isArchived, false),
      ),
    )

  // One effective mapping per section — a cohort-specific mapping wins over a
  // global (cohortId null) one, matching the reference's getTemplate precedence.
  const bySection = new Map<string, (typeof allMappings)[number]>()
  for (const row of allMappings) {
    const key = row.mapping.sectionId
    const existing = bySection.get(key)
    if (!existing) {
      bySection.set(key, row)
      continue
    }
    if (existing.mapping.cohortId === null && cohortId !== null && row.mapping.cohortId === cohortId) {
      bySection.set(key, row)
    }
  }
  const effectiveMappings = Array.from(bySection.values())
  if (effectiveMappings.length === 0) return

  let submittedCount = 0
  for (const { mapping } of effectiveMappings) {
    const [resp] = await db
      .select({ id: formResponses.id })
      .from(formResponses)
      .where(
        and(
          eq(formResponses.tenantId, tenantId),
          eq(formResponses.companyId, companyId),
          eq(formResponses.mappingId, mapping.id),
          eq(formResponses.status, 'submitted'),
        ),
      )
      .limit(1)
    if (resp) submittedCount++
  }

  const completionPercentage = Math.round((submittedCount / effectiveMappings.length) * 100)

  const [existingPillar] = await db
    .select()
    .from(companyPillars)
    .where(and(eq(companyPillars.companyId, companyId), eq(companyPillars.pillarNumber, pillarNumber)))
    .limit(1)
  const wasCompleted = existingPillar?.status === 'completed'
  const justCompleted = completionPercentage >= 100 && !wasCompleted
  const newStatus = justCompleted ? 'completed' : (existingPillar?.status ?? 'locked')

  if (existingPillar) {
    await db
      .update(companyPillars)
      .set({ completionPercentage, status: newStatus, updatedAt: new Date() })
      .where(eq(companyPillars.id, existingPillar.id))
  } else {
    await db.insert(companyPillars).values({ tenantId, companyId, pillarNumber, completionPercentage, status: newStatus })
  }

  if (justCompleted) {
    const numbers = await getDistinctPillarNumbers(tenantId)
    const next = numbers.find((n) => n > pillarNumber)
    if (next !== undefined) {
      const [nextRow] = await db
        .select()
        .from(companyPillars)
        .where(and(eq(companyPillars.companyId, companyId), eq(companyPillars.pillarNumber, next)))
        .limit(1)
      if (!nextRow) {
        await db.insert(companyPillars).values({ tenantId, companyId, pillarNumber: next, status: 'unlocked' })
      } else if (nextRow.status === 'locked') {
        await db.update(companyPillars).set({ status: 'unlocked', updatedAt: new Date() }).where(eq(companyPillars.id, nextRow.id))
      }
    }
  }
}

export async function listPillarDefinitions(tenantId: number) {
  const [numbers, defRows] = await Promise.all([
    getDistinctPillarNumbers(tenantId),
    db.select().from(pillarDefinitions).where(eq(pillarDefinitions.tenantId, tenantId)),
  ])
  const titleByNumber = new Map(defRows.map((d) => [d.pillarNumber, d.title]))
  return numbers.map((n) => ({ pillarNumber: n, title: titleByNumber.get(n) ?? null }))
}

export async function upsertPillarDefinition(tenantId: number, pillarNumber: number, title: string) {
  const [existing] = await db
    .select()
    .from(pillarDefinitions)
    .where(and(eq(pillarDefinitions.tenantId, tenantId), eq(pillarDefinitions.pillarNumber, pillarNumber)))
    .limit(1)
  if (existing) {
    const [updated] = await db
      .update(pillarDefinitions)
      .set({ title, updatedAt: new Date() })
      .where(eq(pillarDefinitions.id, existing.id))
      .returning()
    return updated
  }
  const [created] = await db.insert(pillarDefinitions).values({ tenantId, pillarNumber, title }).returning()
  return created
}
