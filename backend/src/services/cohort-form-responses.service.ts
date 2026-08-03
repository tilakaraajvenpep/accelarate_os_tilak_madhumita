import { eq, and } from 'drizzle-orm'
import { db } from '../db/client'
import { cohortForms, cohortFormResponses, formTemplates, companies, users, type FormQuestion } from '../models'

function isEmptyAnswer(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true
  if (Array.isArray(value)) return value.length === 0
  return false
}

async function getUserDisplayName(userId: number | null) {
  if (userId === null) return null
  const [u] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, userId)).limit(1)
  return u ? u.name || u.email : null
}

/**
 * Resolves whether `userId` (a member of `companyId`'s team) can fill or
 * merely view the given cohort-attached form. `fillPolicy: 'primary_founder'`
 * always designates companies.founderUserId as the filler; `'first_claim'`
 * designates whichever team member's save created the response row first
 * (claimedByUserId) — nobody yet means anyone can become the filler on their
 * next save.
 */
async function resolveAccess(tenantId: number, cohortId: number, formId: number, companyId: number, userId: number) {
  const [cohortForm] = await db
    .select()
    .from(cohortForms)
    .where(and(eq(cohortForms.tenantId, tenantId), eq(cohortForms.cohortId, cohortId), eq(cohortForms.formId, formId)))
    .limit(1)
  if (!cohortForm) return null

  const [company] = await db
    .select({ id: companies.id, founderUserId: companies.founderUserId })
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.tenantId, tenantId)))
    .limit(1)
  if (!company) return null

  const [response] = await db
    .select()
    .from(cohortFormResponses)
    .where(
      and(
        eq(cohortFormResponses.tenantId, tenantId),
        eq(cohortFormResponses.cohortId, cohortId),
        eq(cohortFormResponses.formId, formId),
        eq(cohortFormResponses.companyId, companyId),
      ),
    )
    .limit(1)

  const submitted = response?.status === 'submitted'
  const filler = cohortForm.fillPolicy === 'primary_founder' ? company.founderUserId : (response?.claimedByUserId ?? null)
  const isFiller = filler === null || filler === userId

  const access: 'fillable' | 'locked' | 'view_only' = submitted ? (isFiller ? 'fillable' : 'view_only') : isFiller ? 'fillable' : 'locked'

  return { cohortForm, company, response: response ?? null, access, filler }
}

/** Founder-facing list — every form attached to their cohort, with this founder's access to each. */
export async function listCohortFormsForCompany(tenantId: number, cohortId: number, companyId: number, userId: number) {
  const attached = await db
    .select({ formId: formTemplates.id, title: formTemplates.title })
    .from(cohortForms)
    .innerJoin(formTemplates, eq(cohortForms.formId, formTemplates.id))
    .where(and(eq(cohortForms.tenantId, tenantId), eq(cohortForms.cohortId, cohortId)))

  const rows = await Promise.all(
    attached.map(async (item) => {
      const resolved = await resolveAccess(tenantId, cohortId, item.formId, companyId, userId)
      if (!resolved) return null
      const claimedByName = resolved.access === 'locked' ? await getUserDisplayName(resolved.filler) : null
      return {
        formId: item.formId,
        title: item.title,
        access: resolved.access,
        status: resolved.response?.status ?? 'not_started',
        claimedByName,
      }
    }),
  )
  return rows.filter((r): r is NonNullable<typeof r> => r !== null)
}

/** Founder-facing single-form fetch — returns the schema+existing response, or a locked marker if this user isn't the designated filler. */
export async function getCohortFormForFounder(tenantId: number, cohortId: number, formId: number, companyId: number, userId: number) {
  const resolved = await resolveAccess(tenantId, cohortId, formId, companyId, userId)
  if (!resolved) return null

  if (resolved.access === 'locked') {
    return { locked: true as const, claimedByName: await getUserDisplayName(resolved.filler) }
  }

  const [form] = await db.select().from(formTemplates).where(and(eq(formTemplates.id, formId), eq(formTemplates.tenantId, tenantId))).limit(1)
  if (!form) return null

  return {
    locked: false as const,
    readOnly: resolved.access === 'view_only',
    form: {
      id: form.id,
      title: form.title,
      schema: form.schema,
      category: form.category,
      requireConsent: form.requireConsent,
      consentTermsText: form.consentTermsText,
    },
    response: resolved.response ? { responseJson: resolved.response.responseJson, status: resolved.response.status } : null,
  }
}

export async function saveCohortFormResponse(params: {
  tenantId: number
  cohortId: number
  formId: number
  companyId: number
  userId: number
  responseJson: Record<string, unknown>
  status: 'draft' | 'submitted'
}) {
  const resolved = await resolveAccess(params.tenantId, params.cohortId, params.formId, params.companyId, params.userId)
  if (!resolved) throw new Error('This form is not attached to that cohort')
  if (resolved.access === 'locked') throw new Error('This form is already being filled by another member of your team')
  if (resolved.access === 'view_only') throw new Error('This form has already been submitted by another member of your team')

  const [form] = await db.select().from(formTemplates).where(and(eq(formTemplates.id, params.formId), eq(formTemplates.tenantId, params.tenantId))).limit(1)
  if (!form) throw new Error('Form not found')

  if (params.status === 'submitted') {
    const schema = (form.schema as FormQuestion[]) ?? []
    for (const question of schema) {
      if (question.required && isEmptyAnswer(params.responseJson[question.id])) {
        throw new Error(`Missing required field: ${question.title}`)
      }
    }
  }

  const submittedAt = params.status === 'submitted' ? new Date() : null

  if (resolved.response) {
    const [updated] = await db
      .update(cohortFormResponses)
      .set({ responseJson: params.responseJson, status: params.status, submittedAt, claimedByUserId: params.userId, updatedAt: new Date() })
      .where(eq(cohortFormResponses.id, resolved.response.id))
      .returning()
    return updated
  }

  try {
    const [created] = await db
      .insert(cohortFormResponses)
      .values({
        tenantId: params.tenantId,
        cohortId: params.cohortId,
        formId: params.formId,
        companyId: params.companyId,
        claimedByUserId: params.userId,
        responseJson: params.responseJson,
        status: params.status,
        submittedAt,
      })
      .returning()
    return created
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
      throw new Error('Another member of your team just claimed this form — refresh to see who is filling it in')
    }
    throw err
  }
}
