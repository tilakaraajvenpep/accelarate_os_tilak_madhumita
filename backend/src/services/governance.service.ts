import { eq, and, inArray } from 'drizzle-orm'
import { db } from '../db/client'
import {
  governanceConfigs,
  governanceSessions,
  companies,
  companyPillars,
  pillarDefinitions,
  formResponses,
  formTemplates,
} from '../models'
import { resolveFormLabels } from './form-export.service'
import { transformGovernanceData, narrativeToStructuredDoc, buildGovernancePdfBuffer } from './governance-ai.service'

export class GovernanceError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

// ─── Configs ──────────────────────────────────────────────────────────────

export async function createGovernanceConfig(
  tenantId: number,
  data: { cohortId?: number; applicablePillars: number[]; purpose?: string },
) {
  const [config] = await db
    .insert(governanceConfigs)
    .values({
      tenantId,
      cohortId: data.cohortId ?? null,
      applicablePillars: data.applicablePillars,
      purpose: data.purpose ?? null,
    })
    .returning()
  return config
}

export async function getGovernanceConfigs(tenantId: number, cohortId?: number) {
  return db
    .select()
    .from(governanceConfigs)
    .where(cohortId ? and(eq(governanceConfigs.tenantId, tenantId), eq(governanceConfigs.cohortId, cohortId)) : eq(governanceConfigs.tenantId, tenantId))
    .orderBy(governanceConfigs.createdAt)
}

// ─── Sessions ─────────────────────────────────────────────────────────────

export async function initializeGovernanceSession(tenantId: number, data: { configId: number; companyId: number }) {
  const [existing] = await db
    .select()
    .from(governanceSessions)
    .where(and(eq(governanceSessions.tenantId, tenantId), eq(governanceSessions.configId, data.configId), eq(governanceSessions.companyId, data.companyId)))
    .limit(1)
  if (existing) return existing

  const [config] = await db.select().from(governanceConfigs).where(eq(governanceConfigs.id, data.configId)).limit(1)
  if (!config) throw new GovernanceError('Governance config not found', 404)

  const [session] = await db
    .insert(governanceSessions)
    .values({ tenantId, configId: data.configId, companyId: data.companyId, status: 'draft', rawData: {} })
    .returning()
  return session
}

export async function getGovernanceSessions(tenantId: number, companyId?: number) {
  return db
    .select()
    .from(governanceSessions)
    .where(companyId ? and(eq(governanceSessions.tenantId, tenantId), eq(governanceSessions.companyId, companyId)) : eq(governanceSessions.tenantId, tenantId))
    .orderBy(governanceSessions.createdAt)
}

async function getSessionOrThrow(tenantId: number, sessionId: number) {
  const [session] = await db
    .select()
    .from(governanceSessions)
    .where(and(eq(governanceSessions.id, sessionId), eq(governanceSessions.tenantId, tenantId)))
    .limit(1)
  if (!session) throw new GovernanceError('Session not found', 404)
  return session
}

export async function getGovernanceSessionById(tenantId: number, sessionId: number) {
  return getSessionOrThrow(tenantId, sessionId)
}

/** Gathers a company's pillar completion + submitted "governance_review" form responses into one snapshot. */
async function assembleRawData(tenantId: number, companyId: number, applicablePillars: number[]) {
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1)
  if (!company) throw new GovernanceError('Company not found', 404)

  const pillarRows = applicablePillars.length
    ? await db
        .select({
          pillarNumber: companyPillars.pillarNumber,
          status: companyPillars.status,
          completionPercentage: companyPillars.completionPercentage,
          title: pillarDefinitions.title,
        })
        .from(companyPillars)
        .leftJoin(pillarDefinitions, and(eq(pillarDefinitions.tenantId, tenantId), eq(pillarDefinitions.pillarNumber, companyPillars.pillarNumber)))
        .where(and(eq(companyPillars.companyId, companyId), inArray(companyPillars.pillarNumber, applicablePillars)))
        .orderBy(companyPillars.pillarNumber)
    : []

  const submittedResponses = await db
    .select({ response: formResponses, template: formTemplates })
    .from(formResponses)
    .innerJoin(formTemplates, eq(formResponses.templateId, formTemplates.id))
    .where(and(eq(formResponses.companyId, companyId), eq(formResponses.status, 'submitted'), eq(formTemplates.category, 'governance_review')))

  const forms = submittedResponses.map(({ response, template }) => ({
    formTitle: template.title,
    submittedAt: response.submittedAt,
    answers: resolveFormLabels(response.responseJson as Record<string, unknown>, template.schema ?? []),
  }))

  return {
    company: {
      name: company.name,
      location: company.location,
      establishedYear: company.establishedYear,
      founderName: company.founderName,
    },
    pillars: pillarRows,
    forms,
  }
}

export async function submitGovernanceSession(tenantId: number, sessionId: number, data: { founderNotes?: string }) {
  const session = await getSessionOrThrow(tenantId, sessionId)
  const [config] = await db.select().from(governanceConfigs).where(eq(governanceConfigs.id, session.configId)).limit(1)
  if (!config) throw new GovernanceError('Governance config not found', 404)

  const rawData = await assembleRawData(tenantId, session.companyId, (config.applicablePillars as number[]) ?? [])

  const [updated] = await db
    .update(governanceSessions)
    .set({
      status: 'submitted',
      founderNotes: data.founderNotes ?? session.founderNotes,
      rawData,
      updatedAt: new Date(),
    })
    .where(eq(governanceSessions.id, sessionId))
    .returning()
  return updated
}

export async function submitReview(tenantId: number, sessionId: number, data: { feedback: string; outcome: string }) {
  await getSessionOrThrow(tenantId, sessionId)
  const [updated] = await db
    .update(governanceSessions)
    .set({ status: 'reviewed', feedback: data.feedback, outcome: data.outcome, updatedAt: new Date() })
    .where(eq(governanceSessions.id, sessionId))
    .returning()
  return updated
}

export async function reopenSession(tenantId: number, sessionId: number, data: { feedback?: string }) {
  const session = await getSessionOrThrow(tenantId, sessionId)
  const [updated] = await db
    .update(governanceSessions)
    .set({ status: 'draft', feedback: data.feedback ?? session.feedback, updatedAt: new Date() })
    .where(eq(governanceSessions.id, sessionId))
    .returning()
  return updated
}

// ─── Generation ───────────────────────────────────────────────────────────

export async function generateGovernanceDocument(tenantId: number, sessionId: number) {
  const session = await getSessionOrThrow(tenantId, sessionId)
  const [company] = await db.select().from(companies).where(eq(companies.id, session.companyId)).limit(1)
  if (!company) throw new GovernanceError('Company not found', 404)

  const [config] = await db.select().from(governanceConfigs).where(eq(governanceConfigs.id, session.configId)).limit(1)

  const companyName = company.name || 'This company'
  const narratives = await transformGovernanceData(session.rawData as Record<string, unknown>, companyName, config?.purpose ?? undefined, tenantId)
  const structuredDoc = await narrativeToStructuredDoc(narratives.document_narrative, companyName, tenantId)
  const pdfBuffer = await buildGovernancePdfBuffer(structuredDoc)

  const generatedAt = new Date()
  const [updated] = await db
    .update(governanceSessions)
    .set({ documentPdfData: pdfBuffer.toString('base64'), documentGeneratedAt: generatedAt, updatedAt: generatedAt })
    .where(eq(governanceSessions.id, sessionId))
    .returning()

  return { generated: true, generatedAt: updated.documentGeneratedAt }
}

export async function getGovernanceDocument(tenantId: number, sessionId: number) {
  const session = await getSessionOrThrow(tenantId, sessionId)
  if (!session.documentPdfData) throw new GovernanceError('Document not yet generated', 404)
  return Buffer.from(session.documentPdfData, 'base64')
}
