import { eq, and } from 'drizzle-orm'
import { db } from '../db/client'
import { programCompletions, programFeedbackMappings, programFeedbackResponses, companies, formTemplates } from '../models'
import type { User } from '../models'
import { getAssignedProgramDetailForCompany } from './founder-programs.service'
import { isCompanyMember } from './company-members.service'
import { listMentorAssignments } from './cohort-pillar-mentors.service'

export class ProgramFeedbackError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

// ─── Admin config ───────────────────────────────────────────────────────────

export async function upsertFeedbackMapping(
  tenantId: number,
  programId: number,
  data: { formTemplateId: number; mandatory: boolean; collaborationMode: 'primary_founder' | 'open' },
) {
  const [existing] = await db
    .select()
    .from(programFeedbackMappings)
    .where(and(eq(programFeedbackMappings.tenantId, tenantId), eq(programFeedbackMappings.programId, programId)))
    .limit(1)

  if (existing) {
    const [updated] = await db
      .update(programFeedbackMappings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(programFeedbackMappings.id, existing.id))
      .returning()
    return updated
  }

  const [created] = await db
    .insert(programFeedbackMappings)
    .values({ tenantId, programId, ...data })
    .returning()
  return created
}

export async function getFeedbackMapping(tenantId: number, programId: number) {
  const [mapping] = await db
    .select()
    .from(programFeedbackMappings)
    .where(and(eq(programFeedbackMappings.tenantId, tenantId), eq(programFeedbackMappings.programId, programId), eq(programFeedbackMappings.isActive, true)))
    .limit(1)
  return mapping ?? null
}

// ─── Completion trigger ─────────────────────────────────────────────────────

/**
 * Call right after any action that could complete a program for a company.
 * Fires (returns a payload) only the first time completion is detected —
 * the unique(programId, companyId) row on program_completions is the guard.
 */
export async function checkProgramCompletionAndMaybeTriggerFeedback(tenantId: number, cohortId: number, companyId: number, programId: number) {
  const detail = await getAssignedProgramDetailForCompany(tenantId, cohortId, companyId, programId)
  if (!detail || !detail.completed) return null

  const [inserted] = await db
    .insert(programCompletions)
    .values({ tenantId, programId, companyId })
    .onConflictDoNothing()
    .returning()
  if (!inserted) return null // already fired before — not a fresh transition

  const mapping = await getFeedbackMapping(tenantId, programId)
  if (!mapping) return null

  const [template] = await db.select({ id: formTemplates.id, title: formTemplates.title }).from(formTemplates).where(eq(formTemplates.id, mapping.formTemplateId)).limit(1)
  if (!template) return null

  return { mappingId: mapping.id, mandatory: mapping.mandatory, template }
}

// ─── Access & responses ─────────────────────────────────────────────────────

export type FeedbackAccess = 'fillable' | 'view_only'

export async function resolveFeedbackAccess(
  tenantId: number,
  companyId: number,
  programId: number,
  dbUser: User,
  mapping: { collaborationMode: string },
  existingStatus?: string,
): Promise<FeedbackAccess> {
  if (existingStatus === 'submitted') return 'view_only'

  if (dbUser.role === 'mentor') {
    const [company] = await db.select({ cohortId: companies.cohortId }).from(companies).where(eq(companies.id, companyId)).limit(1)
    if (company?.cohortId) {
      const assignments = await listMentorAssignments(tenantId, dbUser.id)
      if (assignments.some((a) => a.cohortId === company.cohortId)) return 'fillable'
    }
    return 'view_only'
  }

  if (mapping.collaborationMode === 'open') {
    return (await isCompanyMember(companyId, dbUser.id)) ? 'fillable' : 'view_only'
  }

  const [company] = await db.select({ founderUserId: companies.founderUserId }).from(companies).where(eq(companies.id, companyId)).limit(1)
  return company?.founderUserId === dbUser.id ? 'fillable' : 'view_only'
}

async function getResponseRow(tenantId: number, companyId: number, programId: number) {
  const [response] = await db
    .select()
    .from(programFeedbackResponses)
    .where(and(eq(programFeedbackResponses.tenantId, tenantId), eq(programFeedbackResponses.companyId, companyId), eq(programFeedbackResponses.programId, programId)))
    .limit(1)
  return response ?? null
}

export async function getFeedbackState(tenantId: number, companyId: number, programId: number, dbUser: User) {
  const mapping = await getFeedbackMapping(tenantId, programId)
  if (!mapping) return null

  const [template] = await db.select().from(formTemplates).where(eq(formTemplates.id, mapping.formTemplateId)).limit(1)
  if (!template) return null

  const response = await getResponseRow(tenantId, companyId, programId)
  const access = await resolveFeedbackAccess(tenantId, companyId, programId, dbUser, mapping, response?.status)

  return {
    mapping: { id: mapping.id, mandatory: mapping.mandatory, collaborationMode: mapping.collaborationMode },
    template: { id: template.id, title: template.title, schema: template.schema },
    response: response ? { responseJson: response.responseJson, status: response.status, dismissedAt: response.dismissedAt } : null,
    access,
    // The popup should show if the program's complete (implied by the caller
    // even asking), not dismissed/submitted yet.
    pending: !response?.submittedAt && !response?.dismissedAt,
  }
}

export async function saveFeedbackResponse(
  tenantId: number,
  companyId: number,
  programId: number,
  dbUser: User,
  data: { responseJson: Record<string, unknown>; submit: boolean },
) {
  const mapping = await getFeedbackMapping(tenantId, programId)
  if (!mapping) throw new ProgramFeedbackError('No feedback form is configured for this program', 404)

  const existing = await getResponseRow(tenantId, companyId, programId)
  const access = await resolveFeedbackAccess(tenantId, companyId, programId, dbUser, mapping, existing?.status)
  if (access !== 'fillable') throw new ProgramFeedbackError('You are not allowed to fill this form', 403)

  const now = new Date()
  const fields = {
    responseJson: data.responseJson,
    status: data.submit ? 'submitted' : 'draft',
    lastEditedByUserId: dbUser.id,
    ...(data.submit ? { submittedByUserId: dbUser.id, submittedAt: now } : {}),
    updatedAt: now,
  }

  if (existing) {
    const [updated] = await db.update(programFeedbackResponses).set(fields).where(eq(programFeedbackResponses.id, existing.id)).returning()
    return updated
  }

  const [created] = await db
    .insert(programFeedbackResponses)
    .values({ tenantId, programId, companyId, mappingId: mapping.id, ...fields })
    .returning()
  return created
}

export async function dismissFeedbackResponse(tenantId: number, companyId: number, programId: number) {
  const mapping = await getFeedbackMapping(tenantId, programId)
  if (!mapping) throw new ProgramFeedbackError('No feedback form is configured for this program', 404)
  if (mapping.mandatory) throw new ProgramFeedbackError('This feedback form is mandatory and cannot be skipped', 400)

  const existing = await getResponseRow(tenantId, companyId, programId)
  const now = new Date()
  if (existing) {
    const [updated] = await db.update(programFeedbackResponses).set({ dismissedAt: now, updatedAt: now }).where(eq(programFeedbackResponses.id, existing.id)).returning()
    return updated
  }
  const [created] = await db
    .insert(programFeedbackResponses)
    .values({ tenantId, programId, companyId, mappingId: mapping.id, dismissedAt: now })
    .returning()
  return created
}

export async function reopenFeedbackResponse(tenantId: number, companyId: number, programId: number) {
  const existing = await getResponseRow(tenantId, companyId, programId)
  if (!existing) throw new ProgramFeedbackError('No feedback response found', 404)

  const [updated] = await db
    .update(programFeedbackResponses)
    .set({ status: 'draft', submittedAt: null, dismissedAt: null, updatedAt: new Date() })
    .where(eq(programFeedbackResponses.id, existing.id))
    .returning()
  return updated
}
