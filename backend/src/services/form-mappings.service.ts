import { eq, and, or, isNull, asc } from 'drizzle-orm'
import { db } from '../db/client'
import { formMappings, formTemplates } from '../models'

/**
 * Resolves the single active template mapped to a non-pillar-scoped type
 * (e.g. 'mentor_onboarding', 'tenant_admin_onboarding') — a cohort-specific
 * mapping wins over a tenant-wide one (cohortId null), same override rule
 * used for pillar-diagnostic mappings elsewhere. contextId is always
 * 'default' for these types since there's no pillar/section context.
 * Returns null if nothing is mapped (callers should fall back to a
 * hardcoded step in that case).
 */
export async function resolveOnboardingMapping(tenantId: number, type: string, cohortId?: number | null) {
  const rows = await db
    .select({
      id: formMappings.id,
      templateId: formMappings.templateId,
      cohortId: formMappings.cohortId,
      sortOrder: formMappings.sortOrder,
      template: formTemplates,
    })
    .from(formMappings)
    .innerJoin(formTemplates, eq(formMappings.templateId, formTemplates.id))
    .where(
      and(
        eq(formMappings.tenantId, tenantId),
        eq(formMappings.type, type),
        eq(formMappings.contextId, 'default'),
        eq(formMappings.isActive, true),
        eq(formTemplates.isArchived, false),
        cohortId != null ? or(isNull(formMappings.cohortId), eq(formMappings.cohortId, cohortId)) : isNull(formMappings.cohortId),
      ),
    )
    .orderBy(asc(formMappings.sortOrder))

  if (rows.length === 0) return null
  // A cohort-specific row (if any) wins over the tenant-wide one.
  const cohortSpecific = rows.find((r) => r.cohortId !== null)
  return cohortSpecific ?? rows[0]
}

export async function listFormMappings(tenantId: number, type?: string) {
  const conditions = [eq(formMappings.tenantId, tenantId)]
  if (type) conditions.push(eq(formMappings.type, type))
  return db
    .select()
    .from(formMappings)
    .where(and(...conditions))
    .orderBy(asc(formMappings.sortOrder))
}

export async function createFormMapping(params: {
  tenantId: number
  templateId: number
  cohortId?: number | null
  type: string
  contextId: string
  sectionId?: string
}) {
  const cohortCondition =
    params.cohortId != null ? eq(formMappings.cohortId, params.cohortId) : isNull(formMappings.cohortId)

  const [existing] = await db
    .select()
    .from(formMappings)
    .where(
      and(
        eq(formMappings.tenantId, params.tenantId),
        eq(formMappings.templateId, params.templateId),
        eq(formMappings.type, params.type),
        eq(formMappings.contextId, params.contextId),
        eq(formMappings.sectionId, params.sectionId ?? ''),
        cohortCondition,
        eq(formMappings.isActive, true),
      ),
    )
    .limit(1)
  if (existing) return existing

  const [created] = await db
    .insert(formMappings)
    .values({
      tenantId: params.tenantId,
      templateId: params.templateId,
      cohortId: params.cohortId ?? null,
      type: params.type,
      contextId: params.contextId,
      sectionId: params.sectionId ?? '',
    })
    .returning()
  return created
}

export async function reorderFormMappings(tenantId: number, orderedIds: number[]) {
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(formMappings)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(and(eq(formMappings.id, orderedIds[i]), eq(formMappings.tenantId, tenantId)))
    }
  })
}

export async function deleteFormMapping(tenantId: number, id: number) {
  const [deleted] = await db
    .delete(formMappings)
    .where(and(eq(formMappings.id, id), eq(formMappings.tenantId, tenantId)))
    .returning()
  if (!deleted) throw new Error('Mapping not found')
  return deleted
}
