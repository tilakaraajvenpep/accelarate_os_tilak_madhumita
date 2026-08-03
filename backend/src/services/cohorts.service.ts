import { eq, and, desc, count, or } from 'drizzle-orm'
import { db } from '../db/client'
import { cohorts, companies, tenantInvites, cohortTasks, programs } from '../models'

export async function listCohorts(tenantId: number) {
  const [rows, companyCounts, assignedPrograms] = await Promise.all([
    db.select().from(cohorts).where(eq(cohorts.tenantId, tenantId)).orderBy(desc(cohorts.startDate)),
    db
      .select({ cohortId: companies.cohortId, count: count() })
      .from(companies)
      .where(eq(companies.tenantId, tenantId))
      .groupBy(companies.cohortId),
    db
      .selectDistinct({ cohortId: cohortTasks.cohortId, programId: programs.id, programName: programs.name })
      .from(cohortTasks)
      .innerJoin(programs, eq(cohortTasks.programId, programs.id))
      .where(eq(cohortTasks.tenantId, tenantId)),
  ])

  const countByCohort = new Map(companyCounts.filter((c) => c.cohortId !== null).map((c) => [c.cohortId as number, Number(c.count)]))

  const programsByCohort = new Map<number, { id: number; name: string }[]>()
  for (const row of assignedPrograms) {
    if (!programsByCohort.has(row.cohortId)) programsByCohort.set(row.cohortId, [])
    programsByCohort.get(row.cohortId)!.push({ id: row.programId, name: row.programName })
  }

  return rows.map((cohort) => ({
    ...cohort,
    companyCount: countByCohort.get(cohort.id) ?? 0,
    assignedPrograms: programsByCohort.get(cohort.id) ?? [],
  }))
}

export async function getCohortById(tenantId: number, id: number) {
  const [cohort] = await db.select().from(cohorts).where(and(eq(cohorts.id, id), eq(cohorts.tenantId, tenantId))).limit(1)
  return cohort ?? null
}

export async function createCohort(params: { tenantId: number; name: string; startDate: string; endDate: string }) {
  const [created] = await db
    .insert(cohorts)
    .values({ tenantId: params.tenantId, name: params.name, startDate: params.startDate, endDate: params.endDate })
    .returning()
  return created
}

export async function updateCohort(
  tenantId: number,
  id: number,
  data: Partial<{ name: string; startDate: string; endDate: string }>,
) {
  const [updated] = await db
    .update(cohorts)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(cohorts.id, id), eq(cohorts.tenantId, tenantId)))
    .returning()
  if (!updated) throw new Error('Cohort not found')
  return updated
}

export async function deleteCohort(tenantId: number, id: number) {
  const [companyInUse] = await db.select({ id: companies.id }).from(companies).where(eq(companies.cohortId, id)).limit(1)
  if (companyInUse) throw new Error('This cohort has companies in it — remove them first.')

  const [inviteInUse] = await db
    .select({ id: tenantInvites.id })
    .from(tenantInvites)
    .where(and(eq(tenantInvites.cohortId, id), or(eq(tenantInvites.status, 'pending'), eq(tenantInvites.status, 'accepted'))))
    .limit(1)
  if (inviteInUse) throw new Error('This cohort has invites tied to it — remove them first.')

  const [deleted] = await db.delete(cohorts).where(and(eq(cohorts.id, id), eq(cohorts.tenantId, tenantId))).returning()
  if (!deleted) throw new Error('Cohort not found')
  return deleted
}
