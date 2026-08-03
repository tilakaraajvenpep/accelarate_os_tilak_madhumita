import { pgTable, serial, integer, text, timestamp, pgEnum, unique, boolean } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'
import { programs } from './program.model'
import { companies } from './company.model'

export const pillarStatusEnum = pgEnum('pillar_status', ['active', 'inactive'])
export const pillarPurposeEnum = pgEnum('pillar_purpose', ['learning', 'assessment'])

export const pillars = pgTable('pillars', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id')
    .notNull()
    .references(() => tenants.id),
  title: text('title').notNull(),
  description: text('description'),
  // All four nullable so pillars created before these fields existed don't
  // break — new creates always set them (enforced at the app layer).
  programObjective: text('program_objective'),
  phaseCoverage: text('phase_coverage'),
  expectedOutcomes: text('expected_outcomes'),
  founderExpectation: text('founder_expectation'),
  // Nullable so pillars created before this field existed don't break — new
  // creates always set it (enforced at the app layer, not the DB layer).
  programId: integer('program_id').references(() => programs.id),
  sortOrder: integer('sort_order').notNull().default(0),
  // When true, this pillar executes in parallel with the pillar immediately
  // before it in sortOrder (they unlock together) instead of after it —
  // consecutive pillars with this set all form one parallel group. The first
  // pillar in a program can't have this set (there's nothing before it).
  parallelWithPrevious: boolean('parallel_with_previous').notNull().default(false),
  status: pillarStatusEnum('status').notNull().default('active'),
  // 'learning' = today's flow unchanged (complete once every section's forms are
  // submitted). 'assessment' additionally rolls up each submitted form's scored
  // answer options (form_templates question.options[].score) and requires the
  // company to reach passThreshold before the pillar counts as complete/passed.
  purpose: pillarPurposeEnum('purpose').notNull().default('learning'),
  // Percentage (0-100) required to pass — optional even for an assessment
  // pillar; when null, no score-based pass/fail gate applies (it behaves like
  // a learning pillar: complete once every section's forms are submitted).
  passThreshold: integer('pass_threshold'),
  // When false, this pillar doesn't block a program's overall completion even
  // if left unfinished (see getAssignedProgramDetailForCompany) — the pillar
  // still shows its own real progress/pass-fail state, it just isn't required.
  // Always true for learning pillars (no UI to change it there).
  mandatory: boolean('mandatory').notNull().default(true),
  // Consent to schedule this pillar onto a cohort's calendar for a specific
  // date — asked when the pillar is created (moved here from the program).
  showInCalendar: boolean('show_in_calendar').notNull().default(false),
  // Ask whether there is a need to place key takeaways and discussions on this pillar
  hasKeyTakeawaysAndDiscussions: boolean('has_key_takeaways_and_discussions').notNull().default(true),
  // Tenant admin can lock a pillar to block founder access without deleting it.
  locked: boolean('locked').notNull().default(false),
  // When true, founders must fill out this pillar's pillar_checklist_questions
  // (self-report readiness checklist authored by the admin) alongside its forms.
  hasReadinessChecklist: boolean('has_readiness_checklist').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Pillar = typeof pillars.$inferSelect
export type NewPillar = typeof pillars.$inferInsert

// Company-scoped progress tracking for the *dynamic* Forms/Pillars system
// (Phase 2) — not user-scoped, a company's founders/co-founders share one
// progress record. Named company_pillars (and companyPillars here) to avoid
// colliding with the "pillars" content-catalog table/export above, which is
// a separate, admin-curated Program → Pillar → Section feature.
export const companyPillars = pgTable(
  'company_pillars',
  {
    id: serial('id').primaryKey(),
    tenantId: integer('tenant_id')
      .notNull()
      .references(() => tenants.id),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    pillarNumber: integer('pillar_number').notNull(),
    status: text('status').notNull().default('locked'), // 'locked' | 'unlocked' | 'completed'
    completionPercentage: integer('completion_percentage').notNull().default(0),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [unique().on(table.companyId, table.pillarNumber)],
)

export type CompanyPillar = typeof companyPillars.$inferSelect
export type NewCompanyPillar = typeof companyPillars.$inferInsert
