import { pgTable, serial, integer, timestamp, unique } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'
import { cohorts } from './cohort.model'
import { pillars } from './pillar.model'
import { users } from './user.model'

/** Which mentor is assigned to which pillar for a cohort — one mentor per (cohort, pillar), covering every company in that cohort.
 * Set while scheduling a program onto a cohort, or from the standalone "assign mentors" dialog. `pillarId` is null for a
 * general, cohort-wide mentor assigned without picking a specific pillar (e.g. before any program has been scheduled yet) —
 * at most one such row per cohort, enforced in cohort-pillar-mentors.service.ts rather than a DB constraint (Postgres treats
 * every NULL as distinct, so a plain unique index on (cohortId, pillarId) can't cover the null case). */
export const cohortPillarMentors = pgTable(
  'cohort_pillar_mentors',
  {
    id: serial('id').primaryKey(),
    tenantId: integer('tenant_id').notNull().references(() => tenants.id),
    cohortId: integer('cohort_id').notNull().references(() => cohorts.id),
    pillarId: integer('pillar_id').references(() => pillars.id),
    mentorUserId: integer('mentor_user_id').notNull().references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [unique().on(table.cohortId, table.pillarId)],
)

export type CohortPillarMentor = typeof cohortPillarMentors.$inferSelect
export type NewCohortPillarMentor = typeof cohortPillarMentors.$inferInsert
