import { pgTable, serial, integer, text, boolean, timestamp, unique } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'
import { programs } from './program.model'
import { formTemplates } from './form-template.model'

// Admin config: which 'feedback'-category form template (if any) must be
// filled the moment a company finishes this program, and under what rules.
export const programFeedbackMappings = pgTable(
  'program_feedback_mappings',
  {
    id: serial('id').primaryKey(),
    tenantId: integer('tenant_id')
      .notNull()
      .references(() => tenants.id),
    programId: integer('program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),
    formTemplateId: integer('form_template_id')
      .notNull()
      .references(() => formTemplates.id),
    mandatory: boolean('mandatory').notNull().default(true),
    // 'primary_founder' = only companies.founderUserId may fill/submit;
    // 'open' = any company member may fill/submit. A mentor assigned to the
    // company's cohort may always fill it too, regardless of this setting.
    collaborationMode: text('collaboration_mode').notNull().default('primary_founder'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [unique().on(table.programId)],
)

export type ProgramFeedbackMapping = typeof programFeedbackMappings.$inferSelect
export type NewProgramFeedbackMapping = typeof programFeedbackMappings.$inferInsert
