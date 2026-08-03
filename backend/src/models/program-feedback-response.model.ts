import { pgTable, serial, integer, text, jsonb, timestamp, unique } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'
import { programs } from './program.model'
import { companies } from './company.model'
import { programFeedbackMappings } from './program-feedback-mapping.model'
import { users } from './user.model'

// One company's feedback-form submission state for a given program.
export const programFeedbackResponses = pgTable(
  'program_feedback_responses',
  {
    id: serial('id').primaryKey(),
    tenantId: integer('tenant_id')
      .notNull()
      .references(() => tenants.id),
    programId: integer('program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    mappingId: integer('mapping_id')
      .notNull()
      .references(() => programFeedbackMappings.id, { onDelete: 'cascade' }),
    responseJson: jsonb('response_json').notNull().default({}),
    status: text('status').notNull().default('draft'), // 'draft' | 'submitted'
    lastEditedByUserId: integer('last_edited_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    submittedByUserId: integer('submitted_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    submittedAt: timestamp('submitted_at'),
    // Set when an optional (non-mandatory) popup is skipped — the presence
    // of either this or submittedAt is what stops the popup from re-firing.
    dismissedAt: timestamp('dismissed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [unique().on(table.programId, table.companyId)],
)

export type ProgramFeedbackResponse = typeof programFeedbackResponses.$inferSelect
export type NewProgramFeedbackResponse = typeof programFeedbackResponses.$inferInsert
