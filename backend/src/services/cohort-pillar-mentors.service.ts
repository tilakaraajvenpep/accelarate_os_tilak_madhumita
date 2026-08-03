import { eq, and, isNotNull, isNull } from 'drizzle-orm'
import { db } from '../db/client'
import { cohortPillarMentors, pillars, cohorts, cohortTasks, programs, users } from '../models'

/** Every pillar scheduled onto this cohort (across every program assigned to it) — the assignable pool for the standalone "assign mentors" dialog. */
export async function listScheduledPillarsForCohort(tenantId: number, cohortId: number) {
  return db
    .selectDistinct({ id: pillars.id, title: pillars.title, programName: programs.name })
    .from(cohortTasks)
    .innerJoin(pillars, eq(cohortTasks.pillarId, pillars.id))
    .innerJoin(programs, eq(cohortTasks.programId, programs.id))
    .where(and(eq(cohortTasks.tenantId, tenantId), eq(cohortTasks.cohortId, cohortId), isNotNull(cohortTasks.pillarId)))
}

/** Upserts the mentor assigned to each pillar for a cohort — called right after a program is scheduled onto that cohort,
 * or from the standalone "assign mentors" dialog. A `pillarId: null` entry is a general, cohort-wide assignment (no
 * specific pillar yet) — handled as find-then-update-or-insert since `onConflictDoUpdate` can't target a NULL column. */
export async function setCohortPillarMentors(tenantId: number, cohortId: number, assignments: Array<{ pillarId: number | null; mentorUserId: number }>) {
  for (const assignment of assignments) {
    if (assignment.pillarId === null) {
      const [existing] = await db
        .select({ id: cohortPillarMentors.id })
        .from(cohortPillarMentors)
        .where(and(eq(cohortPillarMentors.tenantId, tenantId), eq(cohortPillarMentors.cohortId, cohortId), isNull(cohortPillarMentors.pillarId)))
        .limit(1)
      if (existing) {
        await db.update(cohortPillarMentors).set({ mentorUserId: assignment.mentorUserId, updatedAt: new Date() }).where(eq(cohortPillarMentors.id, existing.id))
      } else {
        await db.insert(cohortPillarMentors).values({ tenantId, cohortId, pillarId: null, mentorUserId: assignment.mentorUserId })
      }
      continue
    }

    await db
      .insert(cohortPillarMentors)
      .values({ tenantId, cohortId, pillarId: assignment.pillarId, mentorUserId: assignment.mentorUserId })
      .onConflictDoUpdate({
        target: [cohortPillarMentors.cohortId, cohortPillarMentors.pillarId],
        set: { mentorUserId: assignment.mentorUserId, updatedAt: new Date() },
      })
  }
}

/** Admin-facing — every pillar-mentor assignment for a cohort, including the general (no-pillar) one if set. */
export async function listCohortPillarMentors(tenantId: number, cohortId: number) {
  return db
    .select({
      pillarId: pillars.id,
      pillarTitle: pillars.title,
      mentorUserId: users.id,
      mentorName: users.name,
      mentorEmail: users.email,
    })
    .from(cohortPillarMentors)
    .leftJoin(pillars, eq(cohortPillarMentors.pillarId, pillars.id))
    .innerJoin(users, eq(cohortPillarMentors.mentorUserId, users.id))
    .where(and(eq(cohortPillarMentors.tenantId, tenantId), eq(cohortPillarMentors.cohortId, cohortId)))
}

/** Mentor-facing — every cohort+pillar this mentor has been assigned to, including general (no-pillar) cohort assignments. */
export async function listMentorAssignments(tenantId: number, mentorUserId: number) {
  return db
    .select({
      cohortId: cohorts.id,
      cohortName: cohorts.name,
      pillarId: pillars.id,
      pillarTitle: pillars.title,
    })
    .from(cohortPillarMentors)
    .innerJoin(cohorts, eq(cohortPillarMentors.cohortId, cohorts.id))
    .leftJoin(pillars, eq(cohortPillarMentors.pillarId, pillars.id))
    .where(and(eq(cohortPillarMentors.tenantId, tenantId), eq(cohortPillarMentors.mentorUserId, mentorUserId)))
    .orderBy(cohorts.name)
}
