import { pgTable, serial, integer, text, timestamp, unique } from 'drizzle-orm/pg-core'
import { sections } from './section.model'
import { formTemplates } from './form-template.model'

/**
 * Which Assessment Form templates are assigned to which section — a section
 * can have multiple. fillPolicy controls who on the founder's team may fill
 * a given one in (see section_form_responses): 'primary_founder' = only the
 * company's original founder (companies.founderUserId); 'first_claim' = any
 * team member, but whoever saves first locks everyone else out of it.
 */
export const sectionForms = pgTable(
  'section_forms',
  {
    id: serial('id').primaryKey(),
    sectionId: integer('section_id')
      .notNull()
      .references(() => sections.id),
    formId: integer('form_id')
      .notNull()
      .references(() => formTemplates.id),
    fillPolicy: text('fill_policy').notNull().default('first_claim'), // 'primary_founder' | 'first_claim'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    sectionFormUnique: unique().on(table.sectionId, table.formId),
  }),
)

export type SectionForm = typeof sectionForms.$inferSelect
export type NewSectionForm = typeof sectionForms.$inferInsert
