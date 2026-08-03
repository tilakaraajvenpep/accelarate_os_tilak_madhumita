import { pgTable, serial, integer, text, date, timestamp } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'
import { cohorts } from './cohort.model'
import { companies } from './company.model'
import { programs } from './program.model'
import { pillars } from './pillar.model'
import { sections } from './section.model'
import { users } from './user.model'

export const cohortTasks = pgTable('cohort_tasks', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id),
  cohortId: integer('cohort_id').notNull().references(() => cohorts.id),
  // Optional — a task can target one company/founder in the cohort, or be left
  // unset for a cohort-wide task.
  companyId: integer('company_id').references(() => companies.id),
  // Set when this entry came from assigning a calendar-enabled Program to this
  // cohort for a date, rather than a manually-created task. pillarId/sectionId
  // identify which specific pillar or section within that program this dated
  // entry is for — the date is per-pillar/section, not per-program.
  programId: integer('program_id').references(() => programs.id),
  pillarId: integer('pillar_id').references(() => pillars.id),
  sectionId: integer('section_id').references(() => sections.id),
  title: text('title').notNull(),
  description: text('description'),
  // Nullable: a program assigned to a cohort with no calendar-enabled
  // pillars/sections yet gets a single placeholder row with no date (see
  // assignProgramToCohort in programs.service.ts) — the cohort_tasks row is
  // what makes the assignment visible to founders at all (see
  // listAssignedProgramsForCompany), independent of whether any date is set.
  startDate: date('start_date'),
  endDate: date('end_date'),
  // Set once the 3-days-before reminder has gone out for this event, so the
  // daily reminder job never sends it twice (see cohort-reminders.service.ts).
  reminderSentAt: timestamp('reminder_sent_at'),
  createdByUserId: integer('created_by_user_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type CohortTask = typeof cohortTasks.$inferSelect
export type NewCohortTask = typeof cohortTasks.$inferInsert
