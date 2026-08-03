import { eq, and } from 'drizzle-orm'
import { db } from '../db/client'
import { cohorts, formTemplates, cohortForms, cohortFormResponses } from '../models'

export const COHORT_FORM_FILL_POLICIES = ['primary_founder', 'first_claim'] as const
export type CohortFormFillPolicy = (typeof COHORT_FORM_FILL_POLICIES)[number]

/** Admin-facing: every Assessment Form currently attached to a cohort. */
export async function listCohortForms(tenantId: number, cohortId: number) {
  return db
    .select({
      id: cohortForms.id,
      formId: formTemplates.id,
      title: formTemplates.title,
      fillPolicy: cohortForms.fillPolicy,
      createdAt: cohortForms.createdAt,
    })
    .from(cohortForms)
    .innerJoin(formTemplates, eq(cohortForms.formId, formTemplates.id))
    .where(and(eq(cohortForms.tenantId, tenantId), eq(cohortForms.cohortId, cohortId)))
}

/** Attaches (or updates the fill policy of) an Assessment Form on a cohort — visible to every company in it. */
export async function attachFormToCohort(tenantId: number, cohortId: number, formId: number, fillPolicy: string) {
  if (!COHORT_FORM_FILL_POLICIES.includes(fillPolicy as CohortFormFillPolicy)) throw new Error('Invalid fill policy')

  const [cohort] = await db.select({ id: cohorts.id }).from(cohorts).where(and(eq(cohorts.id, cohortId), eq(cohorts.tenantId, tenantId))).limit(1)
  if (!cohort) throw new Error('Cohort not found')

  const [form] = await db.select({ id: formTemplates.id }).from(formTemplates).where(and(eq(formTemplates.id, formId), eq(formTemplates.tenantId, tenantId))).limit(1)
  if (!form) throw new Error('Form not found')

  const [existing] = await db.select({ id: cohortForms.id }).from(cohortForms).where(and(eq(cohortForms.cohortId, cohortId), eq(cohortForms.formId, formId))).limit(1)
  if (existing) {
    const [updated] = await db.update(cohortForms).set({ fillPolicy }).where(eq(cohortForms.id, existing.id)).returning()
    return updated
  }

  const [created] = await db.insert(cohortForms).values({ tenantId, cohortId, formId, fillPolicy }).returning()
  return created
}

/** Detaches a form from a cohort — also clears every company's response to it, since it's no longer part of that cohort. */
export async function detachFormFromCohort(tenantId: number, cohortId: number, formId: number) {
  return db.transaction(async (tx) => {
    await tx
      .delete(cohortFormResponses)
      .where(and(eq(cohortFormResponses.tenantId, tenantId), eq(cohortFormResponses.cohortId, cohortId), eq(cohortFormResponses.formId, formId)))
    const [deleted] = await tx
      .delete(cohortForms)
      .where(and(eq(cohortForms.tenantId, tenantId), eq(cohortForms.cohortId, cohortId), eq(cohortForms.formId, formId)))
      .returning()
    if (!deleted) throw new Error('This form is not attached to that cohort')
    return deleted
  })
}
