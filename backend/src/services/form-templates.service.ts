import { eq, and, or, desc, inArray } from 'drizzle-orm'
import { db } from '../db/client'
import { formTemplates, sectionForms, sectionFormResponses, cohortForms, cohortFormResponses, companies, users } from '../models'
import type { FormQuestion } from '../models'

export async function listFormTemplates(tenantId: number) {
  return db
    .select()
    .from(formTemplates)
    .where(eq(formTemplates.tenantId, tenantId))
    .orderBy(desc(formTemplates.createdAt))
}

/** Every submitted/draft response across every version of a form's family (old + current) — the admin response-viewer's data source. */
export async function listFormTemplateResponses(tenantId: number, id: number) {
  const target = await getFormTemplateById(tenantId, id)
  if (!target) return null
  const rootId = target.rootTemplateId ?? target.id

  // The root template itself never has rootTemplateId === its own id (that field
  // is null on it), so the family must also include `id === rootId` explicitly —
  // otherwise an un-forked template's own id is excluded from its own "family"
  // and every title/version lookup below silently misses.
  const family = await db
    .select({ id: formTemplates.id, version: formTemplates.version, schema: formTemplates.schema, requireConsent: formTemplates.requireConsent })
    .from(formTemplates)
    .where(and(eq(formTemplates.tenantId, tenantId), or(eq(formTemplates.id, rootId), eq(formTemplates.rootTemplateId, rootId))))
  const familyIds = family.length > 0 ? family.map((f) => f.id) : [id]
  const versionById = new Map(family.map((f) => [f.id, f.version]))
  const schemaById = new Map(family.map((f) => [f.id, f.schema as FormQuestion[]]))
  const requireConsentById = new Map(family.map((f) => [f.id, f.requireConsent]))

  function toAnswers(formId: number, responseJson: Record<string, unknown>) {
    const schema = schemaById.get(formId) ?? []
    const titleByQuestionId = new Map(schema.map((q) => [q.id, q.title]))
    return Object.entries(responseJson)
      .filter(([questionId]) => questionId !== '_consentAccepted')
      .map(([questionId, value]) => ({
        questionId,
        questionTitle: titleByQuestionId.get(questionId) ?? questionId,
        value,
      }))
  }

  function consentAcceptedFor(formId: number, responseJson: Record<string, unknown>): boolean | null {
    if (!requireConsentById.get(formId)) return null
    return responseJson._consentAccepted === true
  }

  const [sectionRows, cohortRows] = await Promise.all([
    db
      .select({
        formId: sectionFormResponses.formId,
        companyId: companies.id,
        companyName: companies.name,
        founderName: companies.founderName,
        status: sectionFormResponses.status,
        submittedAt: sectionFormResponses.submittedAt,
        responseJson: sectionFormResponses.responseJson,
      })
      .from(sectionFormResponses)
      .innerJoin(companies, eq(companies.id, sectionFormResponses.companyId))
      .where(and(inArray(sectionFormResponses.formId, familyIds), eq(sectionFormResponses.tenantId, tenantId))),
    db
      .select({
        formId: cohortFormResponses.formId,
        companyId: companies.id,
        companyName: companies.name,
        founderName: companies.founderName,
        status: cohortFormResponses.status,
        submittedAt: cohortFormResponses.submittedAt,
        responseJson: cohortFormResponses.responseJson,
      })
      .from(cohortFormResponses)
      .innerJoin(companies, eq(companies.id, cohortFormResponses.companyId))
      .where(and(inArray(cohortFormResponses.formId, familyIds), eq(cohortFormResponses.tenantId, tenantId))),
  ])

  return {
    template: { id: target.id, title: target.title, version: target.version },
    responses: [...sectionRows, ...cohortRows].map((r) => ({
      ...r,
      version: versionById.get(r.formId) ?? null,
      answers: toAnswers(r.formId, r.responseJson as Record<string, unknown>),
      consentAccepted: consentAcceptedFor(r.formId, r.responseJson as Record<string, unknown>),
    })),
  }
}

export async function createFormTemplate(params: {
  tenantId: number
  createdBy: number
  title: string
  description?: string | null
  category: string
  isMultipleEntry?: boolean
  requireConsent?: boolean
  consentTermsText?: string | null
  schema: FormQuestion[]
}) {
  const [template] = await db
    .insert(formTemplates)
    .values({
      tenantId: params.tenantId,
      createdBy: params.createdBy,
      title: params.title,
      description: params.description ?? null,
      category: params.category,
      isMultipleEntry: params.isMultipleEntry ?? false,
      requireConsent: params.requireConsent ?? false,
      consentTermsText: params.consentTermsText ?? null,
      schema: params.schema,
    })
    .returning()
  return template
}

export async function getFormTemplateById(tenantId: number, id: number) {
  const [template] = await db
    .select()
    .from(formTemplates)
    .where(and(eq(formTemplates.id, id), eq(formTemplates.tenantId, tenantId)))
    .limit(1)
  return template ?? null
}

export async function updateFormTemplate(
  tenantId: number,
  id: number,
  params: {
    title?: string
    description?: string | null
    category?: string
    isMultipleEntry?: boolean
    requireConsent?: boolean
    consentTermsText?: string | null
    schema?: FormQuestion[]
  },
) {
  const [existing] = await db
    .select()
    .from(formTemplates)
    .where(and(eq(formTemplates.id, id), eq(formTemplates.tenantId, tenantId)))
    .limit(1)
  if (!existing) return null

  const [updated] = await db
    .update(formTemplates)
    .set({
      title: params.title ?? existing.title,
      description: params.description !== undefined ? params.description : existing.description,
      category: params.category ?? existing.category,
      isMultipleEntry: params.isMultipleEntry ?? existing.isMultipleEntry,
      requireConsent: params.requireConsent ?? existing.requireConsent,
      consentTermsText: params.consentTermsText !== undefined ? params.consentTermsText : existing.consentTermsText,
      schema: params.schema ?? existing.schema,
      version: params.schema ? existing.version + 1 : existing.version,
      updatedAt: new Date(),
    })
    .where(eq(formTemplates.id, id))
    .returning()
  return updated
}

/**
 * Whether saving `newSchema` over an existing template would need to fork a
 * new version instead of updating in place — true only when the schema
 * actually changed AND at least one section/cohort response already exists
 * against this exact formId (nobody's answered yet = safe to edit in place).
 */
export async function previewVersionImpact(tenantId: number, id: number, newSchema: FormQuestion[]) {
  const existing = await getFormTemplateById(tenantId, id)
  if (!existing) throw new Error('Form template not found')

  const schemaChanged = JSON.stringify(existing.schema) !== JSON.stringify(newSchema)
  if (!schemaChanged) return { willFork: false as const }

  const [sectionResponses, cohortResponses] = await Promise.all([
    db.select({ companyId: sectionFormResponses.companyId }).from(sectionFormResponses).where(eq(sectionFormResponses.formId, id)),
    db.select({ companyId: cohortFormResponses.companyId }).from(cohortFormResponses).where(eq(cohortFormResponses.formId, id)),
  ])
  const responseCount = sectionResponses.length + cohortResponses.length
  if (responseCount === 0) return { willFork: false as const }

  const companyIds = new Set([...sectionResponses.map((r) => r.companyId), ...cohortResponses.map((r) => r.companyId)])
  return { willFork: true as const, responseCount, companyCount: companyIds.size, nextVersion: existing.version + 1 }
}

/**
 * Forks a new version of a template that already has responses: the old row
 * (and its exact old schema + every response against it) stays untouched,
 * a new row is inserted with the edited fields, and every section_forms /
 * cohort_forms row pointing at the old formId gets repointed to the new one
 * — which is what makes founders see it as unfilled again (completion is
 * always live-computed off the currently assigned formId).
 */
export async function createNewVersion(
  tenantId: number,
  id: number,
  params: {
    title?: string
    description?: string | null
    category?: string
    isMultipleEntry?: boolean
    requireConsent?: boolean
    consentTermsText?: string | null
    schema: FormQuestion[]
  },
  actingUserId: number,
) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(formTemplates)
      .where(and(eq(formTemplates.id, id), eq(formTemplates.tenantId, tenantId)))
      .limit(1)
    if (!existing) throw new Error('Form template not found')
    if (existing.supersededByFormId) throw new Error('This template has already been superseded by a newer version — reload and try again')

    const [created] = await tx
      .insert(formTemplates)
      .values({
        tenantId,
        createdBy: actingUserId,
        title: params.title ?? existing.title,
        description: params.description !== undefined ? params.description : existing.description,
        category: params.category ?? existing.category,
        isMultipleEntry: params.isMultipleEntry ?? existing.isMultipleEntry,
        requireConsent: params.requireConsent ?? existing.requireConsent,
        consentTermsText: params.consentTermsText !== undefined ? params.consentTermsText : existing.consentTermsText,
        schema: params.schema,
        version: existing.version + 1,
        rootTemplateId: existing.rootTemplateId ?? existing.id,
        previousVersionId: existing.id,
      })
      .returning()

    await tx.update(formTemplates).set({ supersededByFormId: created.id, isArchived: true, updatedAt: new Date() }).where(eq(formTemplates.id, existing.id))
    await tx.update(sectionForms).set({ formId: created.id }).where(eq(sectionForms.formId, existing.id))
    await tx.update(cohortForms).set({ formId: created.id }).where(eq(cohortForms.formId, existing.id))

    const [sectionTargets, cohortTargets] = await Promise.all([
      tx
        .select({ userId: users.id, email: users.email, name: users.name })
        .from(sectionFormResponses)
        .innerJoin(companies, eq(companies.id, sectionFormResponses.companyId))
        .innerJoin(users, eq(users.id, companies.founderUserId))
        .where(and(eq(sectionFormResponses.formId, existing.id), eq(sectionFormResponses.status, 'submitted'))),
      tx
        .select({ userId: users.id, email: users.email, name: users.name })
        .from(cohortFormResponses)
        .innerJoin(users, eq(users.id, cohortFormResponses.claimedByUserId))
        .where(and(eq(cohortFormResponses.formId, existing.id), eq(cohortFormResponses.status, 'submitted'))),
    ])
    const seen = new Set<number>()
    const notifyTargets = [...sectionTargets, ...cohortTargets].filter((t) => {
      if (seen.has(t.userId)) return false
      seen.add(t.userId)
      return true
    })

    return { template: created, notifyTargets }
  })
}

export async function duplicateFormTemplate(tenantId: number, id: number, createdBy: number) {
  const existing = await getFormTemplateById(tenantId, id)
  if (!existing) throw new Error('Form template not found')

  const [copy] = await db
    .insert(formTemplates)
    .values({
      tenantId,
      createdBy,
      title: `${existing.title} (copy)`,
      description: existing.description,
      category: existing.category,
      isMultipleEntry: existing.isMultipleEntry,
      requireConsent: existing.requireConsent,
      consentTermsText: existing.consentTermsText,
      schema: existing.schema,
    })
    .returning()
  return copy
}

export async function setFormTemplateArchived(tenantId: number, id: number, isArchived: boolean) {
  const [updated] = await db
    .update(formTemplates)
    .set({ isArchived, updatedAt: new Date() })
    .where(and(eq(formTemplates.id, id), eq(formTemplates.tenantId, tenantId)))
    .returning()
  return updated ?? null
}

export async function deleteFormTemplate(tenantId: number, id: number) {
  const [deleted] = await db
    .delete(formTemplates)
    .where(and(eq(formTemplates.id, id), eq(formTemplates.tenantId, tenantId)))
    .returning()
  if (!deleted) throw new Error('Form template not found')
  return deleted
}
