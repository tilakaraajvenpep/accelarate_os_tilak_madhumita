import { eq, and, inArray } from 'drizzle-orm'
import { db } from '../db/client'
import { formResponses, formMappings, formTemplates, companies } from '../models'
import type { FormQuestion } from '../models'
import { recalculatePillarCompletion } from './company-pillars.service'

/** The list-for-section equivalent: finds active mappings for a (type,
 * contextId[, sectionId]) slot, cohort-aware (a mapping scoped to the
 * company's cohort wins over a global one), and expands into one entry per
 * response — 0 responses on a template → one unfilled placeholder entry, N
 * responses on a multi-entry template → N entries. */
export async function resolveTemplatesForSection(params: {
  tenantId: number
  companyId: number
  type: string
  contextId: string
  sectionId?: string
}) {
  const { tenantId, companyId, type, contextId } = params

  const [company] = await db.select({ cohortId: companies.cohortId }).from(companies).where(eq(companies.id, companyId)).limit(1)
  const cohortId = company?.cohortId ?? null

  const conditions = [
    eq(formMappings.tenantId, tenantId),
    eq(formMappings.type, type),
    eq(formMappings.contextId, contextId),
    eq(formMappings.isActive, true),
    eq(formTemplates.isArchived, false),
  ]
  if (params.sectionId !== undefined) conditions.push(eq(formMappings.sectionId, params.sectionId))

  const rows = await db
    .select({ mapping: formMappings, template: formTemplates })
    .from(formMappings)
    .innerJoin(formTemplates, eq(formMappings.templateId, formTemplates.id))
    .where(and(...conditions))
    .orderBy(formMappings.sortOrder)

  // One effective mapping per (sectionId): a cohort-specific mapping wins over global.
  const bySection = new Map<string, (typeof rows)[number]>()
  for (const row of rows) {
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
  const effective = Array.from(bySection.values())
  if (effective.length === 0) return []

  const mappingIds = effective.map((r) => r.mapping.id)
  const responses = await db
    .select()
    .from(formResponses)
    .where(and(eq(formResponses.companyId, companyId), inArray(formResponses.mappingId, mappingIds)))

  const responsesByMapping = new Map<number, typeof responses>()
  for (const r of responses) {
    const list = responsesByMapping.get(r.mappingId) ?? []
    list.push(r)
    responsesByMapping.set(r.mappingId, list)
  }

  const instances: Array<{
    mappingId: number
    sectionId: string
    template: typeof formTemplates.$inferSelect
    hasResponse: boolean
    response: (typeof formResponses.$inferSelect) | null
  }> = []

  for (const { mapping, template } of effective) {
    const mappingResponses = responsesByMapping.get(mapping.id) ?? []
    if (mappingResponses.length === 0) {
      instances.push({ mappingId: mapping.id, sectionId: mapping.sectionId, template, hasResponse: false, response: null })
    } else {
      for (const response of mappingResponses) {
        instances.push({ mappingId: mapping.id, sectionId: mapping.sectionId, template, hasResponse: true, response })
      }
    }
  }
  return instances
}

function isEmptyAnswer(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true
  if (Array.isArray(value)) return value.length === 0
  return false
}

export async function saveResponse(params: {
  tenantId: number
  companyId: number
  userId: number
  templateId: number
  mappingId: number
  responseId?: number | null
  responseJson: Record<string, unknown>
  status: 'draft' | 'submitted'
}) {
  const [template] = await db
    .select()
    .from(formTemplates)
    .where(and(eq(formTemplates.id, params.templateId), eq(formTemplates.tenantId, params.tenantId)))
    .limit(1)
  if (!template) throw new Error('Form template not found')

  // Consent is a stricter gate than required-field validation — enforced on
  // every save (including drafts), matching the client's "not usable at all
  // until consent is given" behavior, not just on final submit.
  if (template.requireConsent && params.responseJson._consentAccepted !== true) {
    throw new Error('You must agree to the Terms and Conditions before saving this form.')
  }

  if (params.status === 'submitted') {
    const schema = (template.schema as FormQuestion[]) ?? []
    for (const question of schema) {
      if (question.required && isEmptyAnswer(params.responseJson[question.id])) {
        throw new Error(`Missing required field: ${question.title}`)
      }
    }
  }

  const submittedAt = params.status === 'submitted' ? new Date() : null
  let saved: typeof formResponses.$inferSelect

  if (params.responseId) {
    const [existing] = await db
      .select()
      .from(formResponses)
      .where(and(eq(formResponses.id, params.responseId), eq(formResponses.companyId, params.companyId)))
      .limit(1)
    if (!existing) throw new Error('Response not found')

    const [updated] = await db
      .update(formResponses)
      .set({
        responseJson: params.responseJson,
        status: params.status,
        submittedAt: submittedAt ?? existing.submittedAt,
        lastEditedByUserId: params.userId,
        updatedAt: new Date(),
      })
      .where(eq(formResponses.id, existing.id))
      .returning()
    saved = updated
  } else if (!template.isMultipleEntry) {
    const [existing] = await db
      .select()
      .from(formResponses)
      .where(and(eq(formResponses.companyId, params.companyId), eq(formResponses.mappingId, params.mappingId)))
      .limit(1)

    if (existing) {
      const [updated] = await db
        .update(formResponses)
        .set({
          responseJson: params.responseJson,
          status: params.status,
          submittedAt: submittedAt ?? existing.submittedAt,
          lastEditedByUserId: params.userId,
          updatedAt: new Date(),
        })
        .where(eq(formResponses.id, existing.id))
        .returning()
      saved = updated
    } else {
      const [created] = await db
        .insert(formResponses)
        .values({
          tenantId: params.tenantId,
          templateId: params.templateId,
          mappingId: params.mappingId,
          companyId: params.companyId,
          lastEditedByUserId: params.userId,
          responseJson: params.responseJson,
          status: params.status,
          submittedAt,
        })
        .returning()
      saved = created
    }
  } else {
    const [created] = await db
      .insert(formResponses)
      .values({
        tenantId: params.tenantId,
        templateId: params.templateId,
        mappingId: params.mappingId,
        companyId: params.companyId,
        lastEditedByUserId: params.userId,
        responseJson: params.responseJson,
        status: params.status,
        submittedAt,
      })
      .returning()
    saved = created
  }

  try {
    const [mapping] = await db.select().from(formMappings).where(eq(formMappings.id, params.mappingId)).limit(1)
    if (mapping?.type === 'pillar_diagnostic') {
      const pillarNumber = parseInt(mapping.contextId, 10)
      if (!isNaN(pillarNumber)) {
        await recalculatePillarCompletion(params.tenantId, params.companyId, pillarNumber)
      }
    }
  } catch (err) {
    console.error('[form-responses] pillar completion recalculation failed:', err)
  }

  return saved
}

export async function getResponse(tenantId: number, companyId: number, id: number) {
  const [response] = await db
    .select()
    .from(formResponses)
    .where(and(eq(formResponses.id, id), eq(formResponses.tenantId, tenantId), eq(formResponses.companyId, companyId)))
    .limit(1)
  return response ?? null
}

export async function deleteResponse(tenantId: number, companyId: number, id: number) {
  const [deleted] = await db
    .delete(formResponses)
    .where(and(eq(formResponses.id, id), eq(formResponses.tenantId, tenantId), eq(formResponses.companyId, companyId)))
    .returning()
  if (!deleted) throw new Error('Response not found')
  return deleted
}

export async function getMappingById(tenantId: number, id: number) {
  const [mapping] = await db
    .select()
    .from(formMappings)
    .where(and(eq(formMappings.id, id), eq(formMappings.tenantId, tenantId)))
    .limit(1)
  return mapping ?? null
}
