import { pgTable, serial, integer, text, jsonb, timestamp, unique } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'
import { companies } from './company.model'
import { sections } from './section.model'
import { formTemplates } from './form-template.model'
import { users } from './user.model'

// A company's answers to one form assigned to one section. Keyed by
// (companyId, sectionId, formId) rather than by pillar — a section can be
// attached to more than one pillar (pillar_sections has no cardinality
// limit), so filling a form once should count wherever that section appears.
export const sectionFormResponses = pgTable(
  'section_form_responses',
  {
    id: serial('id').primaryKey(),
    tenantId: integer('tenant_id').notNull().references(() => tenants.id),
    companyId: integer('company_id').notNull().references(() => companies.id),
    sectionId: integer('section_id').notNull().references(() => sections.id),
    formId: integer('form_id').notNull().references(() => formTemplates.id),
    // Which team member "owns" this form under a 'first_claim' fillPolicy —
    // set the first time anyone on the team saves a response, so co-founders
    // can't overwrite each other's answers (see section_forms.fillPolicy and
    // resolveSectionFormAccess in section-form-responses.service.ts).
    claimedByUserId: integer('claimed_by_user_id').references(() => users.id),
    responseJson: jsonb('response_json').notNull().default({}),
    status: text('status').notNull().default('draft'), // 'draft' | 'submitted'
    submittedAt: timestamp('submitted_at'),
    // Optional single document the founder attaches alongside their answers —
    // same base64-data-URL storage as cohort_documents, no S3 infra in this app.
    documentFileName: text('document_file_name'),
    documentFileType: text('document_file_type'),
    documentFileData: text('document_file_data'),
    documentFileSize: integer('document_file_size'),
    // A founder can "branch out" once a response is submitted to start a fresh,
    // independent attempt at the same form instead of being locked forever —
    // branchNumber 1 is the original response, 2+ are later attempts. All
    // branches remain viewable; there's no single "current" one enforced here.
    branchNumber: integer('branch_number').notNull().default(1),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [unique().on(table.companyId, table.sectionId, table.formId, table.branchNumber)],
)

export type SectionFormResponse = typeof sectionFormResponses.$inferSelect
export type NewSectionFormResponse = typeof sectionFormResponses.$inferInsert
