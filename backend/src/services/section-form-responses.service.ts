import { eq, and, inArray, desc, asc } from 'drizzle-orm'
import { db } from '../db/client'
import { formTemplates, sectionForms, sectionFormResponses, sectionCompletions, companies, users, type FormQuestion } from '../models'
import { scoreAnswer, type AnswerScore } from './ai-scoring.service'

function isEmptyAnswer(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true
  if (Array.isArray(value)) return value.length === 0
  return false
}

export async function getUserDisplayName(userId: number | null) {
  if (userId === null) return null
  const [u] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, userId)).limit(1)
  return u ? u.name || u.email : null
}

/**
 * Resolves whether `userId` (a member of `companyId`'s team) can fill or
 * merely view a section's assigned form. `fillPolicy: 'primary_founder'`
 * always designates companies.founderUserId as the filler; `'first_claim'`
 * designates whichever team member's save created the response row first
 * (claimedByUserId) — nobody yet means anyone can become the filler on their
 * next save. Unlike cohort forms, a submitted section form is always
 * view_only for everyone (including the original filler) — no resubmission,
 * matching the existing once-submitted lock (see routes/founder-programs.ts).
 */
export async function resolveSectionFormAccess(tenantId: number, sectionId: number, formId: number, companyId: number, userId: number) {
  const [link] = await db
    .select({ fillPolicy: sectionForms.fillPolicy })
    .from(sectionForms)
    .where(and(eq(sectionForms.sectionId, sectionId), eq(sectionForms.formId, formId)))
    .limit(1)
  if (!link) return null

  const [company] = await db
    .select({ id: companies.id, founderUserId: companies.founderUserId })
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.tenantId, tenantId)))
    .limit(1)
  if (!company) return null

  const response = await getSectionFormResponse(tenantId, companyId, sectionId, formId)

  const submitted = response?.status === 'submitted'
  const filler = link.fillPolicy === 'primary_founder' ? company.founderUserId : (response?.claimedByUserId ?? null)
  const isFiller = filler === null || filler === userId

  const access: 'fillable' | 'locked' | 'view_only' = submitted ? 'view_only' : isFiller ? 'fillable' : 'locked'

  return { fillPolicy: link.fillPolicy, response, access, filler }
}

export async function getFormForSection(tenantId: number, sectionId: number, formId: number) {
  const [link] = await db.select({ id: sectionForms.id }).from(sectionForms).where(and(eq(sectionForms.sectionId, sectionId), eq(sectionForms.formId, formId))).limit(1)
  if (!link) return null
  const [form] = await db.select().from(formTemplates).where(and(eq(formTemplates.id, formId), eq(formTemplates.tenantId, tenantId))).limit(1)
  return form ?? null
}

/** The document attached to one submitted response, fetched on demand (not inlined into bulk answer lists). */
export async function getSectionFormResponseDocument(tenantId: number, companyId: number, sectionId: number, formId: number, branchNumber?: number) {
  const response = await getSectionFormResponse(tenantId, companyId, sectionId, formId, branchNumber)
  if (!response || !response.documentFileName) return null
  return {
    fileName: response.documentFileName,
    fileType: response.documentFileType!,
    fileData: response.documentFileData!,
    fileSize: response.documentFileSize!,
  }
}

/** Defaults to the highest branchNumber (the most recent attempt) when omitted — every
 * existing single-branch caller keeps working unchanged, and "branch out" (see
 * branchSectionFormResponse) naturally becomes the new "current" response once created. */
export async function getSectionFormResponse(tenantId: number, companyId: number, sectionId: number, formId: number, branchNumber?: number) {
  const [response] = await db
    .select()
    .from(sectionFormResponses)
    .where(
      and(
        eq(sectionFormResponses.tenantId, tenantId),
        eq(sectionFormResponses.companyId, companyId),
        eq(sectionFormResponses.sectionId, sectionId),
        eq(sectionFormResponses.formId, formId),
        ...(branchNumber !== undefined ? [eq(sectionFormResponses.branchNumber, branchNumber)] : []),
      ),
    )
    .orderBy(desc(sectionFormResponses.branchNumber))
    .limit(1)
  return response ?? null
}

/** Every attempt at this form, oldest first — for the founder's "Attempt N" history selector. */
export async function listResponseBranches(tenantId: number, companyId: number, sectionId: number, formId: number) {
  return db
    .select({ id: sectionFormResponses.id, branchNumber: sectionFormResponses.branchNumber, status: sectionFormResponses.status, submittedAt: sectionFormResponses.submittedAt })
    .from(sectionFormResponses)
    .where(
      and(
        eq(sectionFormResponses.tenantId, tenantId),
        eq(sectionFormResponses.companyId, companyId),
        eq(sectionFormResponses.sectionId, sectionId),
        eq(sectionFormResponses.formId, formId),
      ),
    )
    .orderBy(asc(sectionFormResponses.branchNumber))
}

/** Starts a fresh, independent attempt at a form once the current one is submitted — the
 * prior attempt stays exactly as it was, viewable via listResponseBranches. */
export async function branchSectionFormResponse(tenantId: number, companyId: number, sectionId: number, formId: number, userId: number) {
  const branches = await listResponseBranches(tenantId, companyId, sectionId, formId)
  if (branches.length === 0) throw new Error('This form has no response yet to branch out from')
  const latest = branches[branches.length - 1]
  if (latest.status !== 'submitted') throw new Error('Submit the current response before branching out')

  const [created] = await db
    .insert(sectionFormResponses)
    .values({
      tenantId,
      companyId,
      sectionId,
      formId,
      branchNumber: latest.branchNumber + 1,
      status: 'draft',
      responseJson: {},
      claimedByUserId: userId,
    })
    .returning()
  return created
}

/** Every attempt (branch) of every response for a set of sections, oldest-first within each
 * (sectionId, formId) group — the single source of truth the program tree builds both the
 * "latest state" summary AND the full per-attempt history from (see attachFormsAndCompletion
 * in founder-programs.service.ts), instead of separately querying "latest only" and "all". */
export async function listAllResponsesForSections(tenantId: number, companyId: number, sectionIds: number[]) {
  if (sectionIds.length === 0) return []
  return db
    .select({
      sectionId: sectionFormResponses.sectionId,
      formId: sectionFormResponses.formId,
      branchNumber: sectionFormResponses.branchNumber,
      status: sectionFormResponses.status,
      claimedByUserId: sectionFormResponses.claimedByUserId,
      submittedAt: sectionFormResponses.submittedAt,
      responseJson: sectionFormResponses.responseJson,
      documentFileName: sectionFormResponses.documentFileName,
    })
    .from(sectionFormResponses)
    .where(
      and(
        eq(sectionFormResponses.tenantId, tenantId),
        eq(sectionFormResponses.companyId, companyId),
        inArray(sectionFormResponses.sectionId, sectionIds),
      ),
    )
    .orderBy(asc(sectionFormResponses.branchNumber))
}

/** Which of a company's sections (out of a set) have been manually marked done — for sections with no forms attached. */
export async function listManuallyCompletedSections(tenantId: number, companyId: number, sectionIds: number[]) {
  if (sectionIds.length === 0) return []
  return db
    .select({ sectionId: sectionCompletions.sectionId })
    .from(sectionCompletions)
    .where(and(eq(sectionCompletions.tenantId, tenantId), eq(sectionCompletions.companyId, companyId), inArray(sectionCompletions.sectionId, sectionIds)))
}

/** Marks a form-less section as done — only valid when the section has no forms assigned (those complete via submission instead). */
export async function markSectionComplete(tenantId: number, companyId: number, sectionId: number) {
  const [existingForm] = await db.select({ id: sectionForms.id }).from(sectionForms).where(eq(sectionForms.sectionId, sectionId)).limit(1)
  if (existingForm) throw new Error('This section has forms to fill in — submit them instead of marking it done.')

  const [existing] = await db
    .select({ id: sectionCompletions.id })
    .from(sectionCompletions)
    .where(and(eq(sectionCompletions.tenantId, tenantId), eq(sectionCompletions.companyId, companyId), eq(sectionCompletions.sectionId, sectionId)))
    .limit(1)
  if (existing) return existing

  const [created] = await db.insert(sectionCompletions).values({ tenantId, companyId, sectionId }).returning()
  return created
}

export async function saveSectionFormResponse(params: {
  tenantId: number
  companyId: number
  sectionId: number
  formId: number
  responseJson: Record<string, unknown>
  status: 'draft' | 'submitted'
  // The founder saving claims a 'first_claim' form for their whole team (see
  // resolveSectionFormAccess) — null for a mentor's override save, which must
  // never assign or clobber the team's own claim.
  userId: number | null
  // undefined = leave whatever document is already attached untouched (e.g. re-saving
  // a draft without touching the file field); null = explicitly remove it.
  document?: { fileName: string; fileType: string; fileData: string; fileSize: number } | null
  // Omitted = operate on the latest existing branch (or create branch 1 if none exists yet)
  // — the common case. Only set explicitly right after branchSectionFormResponse creates a
  // new branch, so the very next save lands on that branch rather than a stale "latest" read.
  branchNumber?: number
}) {
  const form = await getFormForSection(params.tenantId, params.sectionId, params.formId)
  if (!form) throw new Error('This form is not assigned to that section')

  if (params.status === 'submitted') {
    const schema = (form.schema as FormQuestion[]) ?? []
    for (const question of schema) {
      if (question.required && isEmptyAnswer(params.responseJson[question.id])) {
        throw new Error(`Missing required field: ${question.title}`)
      }
    }

    const existingAiScores = (params.responseJson._aiScores as Record<string, AnswerScore>) || {}
    const newAiScores: Record<string, AnswerScore> = { ...existingAiScores }

    for (const question of schema) {
      if (question.type === 'short_text' || question.type === 'long_text') {
        const val = params.responseJson[question.id]
        if (typeof val === 'string' && val.trim().length >= 5 && !newAiScores[question.id]) {
          try {
            const scoreRes = await scoreAnswer(params.tenantId, question.title, val)
            newAiScores[question.id] = scoreRes
          } catch (err) {
            console.error(`[saveSectionFormResponse] Error scoring question ${question.id}:`, err)
          }
        }
      }
    }

    const allScores = Object.values(newAiScores)
    if (allScores.length > 0) {
      params.responseJson._aiScores = newAiScores
      params.responseJson._overallAiScore = Math.round(allScores.reduce((sum, s) => sum + s.score, 0) / allScores.length)
    }
  }

  const existing = await getSectionFormResponse(params.tenantId, params.companyId, params.sectionId, params.formId, params.branchNumber)
  const submittedAt = params.status === 'submitted' ? new Date() : null

  const documentFields =
    params.document === undefined
      ? {}
      : params.document === null
        ? { documentFileName: null, documentFileType: null, documentFileData: null, documentFileSize: null }
        : {
            documentFileName: params.document.fileName,
            documentFileType: params.document.fileType,
            documentFileData: params.document.fileData,
            documentFileSize: params.document.fileSize,
          }

  if (existing) {
    const [updated] = await db
      .update(sectionFormResponses)
      .set({
        responseJson: params.responseJson,
        status: params.status,
        submittedAt,
        claimedByUserId: params.userId ?? existing.claimedByUserId,
        updatedAt: new Date(),
        ...documentFields,
      })
      .where(eq(sectionFormResponses.id, existing.id))
      .returning()
    return updated
  }

  const [created] = await db
    .insert(sectionFormResponses)
    .values({
      tenantId: params.tenantId,
      companyId: params.companyId,
      sectionId: params.sectionId,
      formId: params.formId,
      branchNumber: params.branchNumber ?? 1,
      responseJson: params.responseJson,
      status: params.status,
      submittedAt,
      claimedByUserId: params.userId,
      ...documentFields,
    })
    .returning()
  return created
}
