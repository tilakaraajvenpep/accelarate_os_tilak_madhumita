import { eq, and, asc } from 'drizzle-orm'
import { db } from '../db/client'
import { cohortTasks, cohorts, companies, programs, users, pillars, sections } from '../models'

async function assertCohortOwnership(tenantId: number, cohortId: number) {
  const [cohort] = await db.select().from(cohorts).where(and(eq(cohorts.id, cohortId), eq(cohorts.tenantId, tenantId))).limit(1)
  if (!cohort) throw new Error('Cohort not found')
}

export async function listCohortTasks(tenantId: number, cohortId: number) {
  await assertCohortOwnership(tenantId, cohortId)

  const rows = await db
    .select({
      id: cohortTasks.id,
      cohortId: cohortTasks.cohortId,
      companyId: cohortTasks.companyId,
      companyName: companies.name,
      programId: cohortTasks.programId,
      programName: programs.name,
      pillarId: cohortTasks.pillarId,
      sectionId: cohortTasks.sectionId,
      title: cohortTasks.title,
      description: cohortTasks.description,
      programDescription: programs.description,
      pillarDescription: pillars.description,
      sectionDescription: sections.description,
      startDate: cohortTasks.startDate,
      endDate: cohortTasks.endDate,
      createdByUserId: cohortTasks.createdByUserId,
      createdByName: users.name,
      createdAt: cohortTasks.createdAt,
      updatedAt: cohortTasks.updatedAt,
    })
    .from(cohortTasks)
    .leftJoin(companies, eq(cohortTasks.companyId, companies.id))
    .leftJoin(programs, eq(cohortTasks.programId, programs.id))
    .leftJoin(pillars, eq(cohortTasks.pillarId, pillars.id))
    .leftJoin(sections, eq(cohortTasks.sectionId, sections.id))
    .leftJoin(users, eq(cohortTasks.createdByUserId, users.id))
    .where(and(eq(cohortTasks.tenantId, tenantId), eq(cohortTasks.cohortId, cohortId)))
    .orderBy(asc(cohortTasks.startDate))

  return rows.map((row) => {
    let resolvedDescription = row.description
    if (!resolvedDescription) {
      if (row.sectionId && row.sectionDescription) {
        resolvedDescription = row.sectionDescription
      } else if (row.pillarId && row.pillarDescription) {
        resolvedDescription = row.pillarDescription
      } else if (row.programId && row.programDescription) {
        resolvedDescription = row.programDescription
      }
    }
    return {
      id: row.id,
      cohortId: row.cohortId,
      companyId: row.companyId,
      companyName: row.companyName,
      programId: row.programId,
      programName: row.programName,
      pillarId: row.pillarId,
      sectionId: row.sectionId,
      title: row.title,
      description: resolvedDescription,
      startDate: row.startDate,
      endDate: row.endDate,
      createdByUserId: row.createdByUserId,
      createdByName: row.createdByName,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  })
}

export async function createCohortTask(params: {
  tenantId: number
  cohortId: number
  companyId?: number | null
  title: string
  description?: string | null
  startDate: string
  endDate?: string | null
  createdByUserId: number
}) {
  await assertCohortOwnership(params.tenantId, params.cohortId)

  if (params.endDate && params.endDate < params.startDate) {
    throw new Error('End date must be on or after the start date')
  }

  if (params.companyId != null) {
    const [company] = await db
      .select()
      .from(companies)
      .where(and(eq(companies.id, params.companyId), eq(companies.cohortId, params.cohortId)))
      .limit(1)
    if (!company) throw new Error('Company not found in this cohort')
  }

  const [created] = await db
    .insert(cohortTasks)
    .values({
      tenantId: params.tenantId,
      cohortId: params.cohortId,
      companyId: params.companyId ?? null,
      title: params.title,
      description: params.description ?? null,
      startDate: params.startDate,
      endDate: params.endDate ?? null,
      createdByUserId: params.createdByUserId,
    })
    .returning()
  return created
}

export async function updateCohortTask(
  tenantId: number,
  cohortId: number,
  id: number,
  data: Partial<{ title: string; description: string | null; startDate: string; endDate: string | null; companyId: number | null }>,
) {
  await assertCohortOwnership(tenantId, cohortId)

  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    throw new Error('End date must be on or after the start date')
  }

  if (data.companyId != null) {
    const [company] = await db
      .select()
      .from(companies)
      .where(and(eq(companies.id, data.companyId), eq(companies.cohortId, cohortId)))
      .limit(1)
    if (!company) throw new Error('Company not found in this cohort')
  }

  const [updated] = await db
    .update(cohortTasks)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(cohortTasks.id, id), eq(cohortTasks.tenantId, tenantId), eq(cohortTasks.cohortId, cohortId)))
    .returning()
  if (!updated) throw new Error('Task not found')
  return updated
}

export async function deleteCohortTask(tenantId: number, cohortId: number, id: number) {
  const [deleted] = await db
    .delete(cohortTasks)
    .where(and(eq(cohortTasks.id, id), eq(cohortTasks.tenantId, tenantId), eq(cohortTasks.cohortId, cohortId)))
    .returning()
  if (!deleted) throw new Error('Task not found')
  return deleted
}
