import { pgTable, serial, integer, text, jsonb, timestamp } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'
import { formTemplates } from './form-template.model'
import { formMappings } from './form-mapping.model'
import { companies } from './company.model'
import { users } from './user.model'

export const formResponses = pgTable('form_responses', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id')
    .notNull()
    .references(() => tenants.id),
  templateId: integer('template_id')
    .notNull()
    .references(() => formTemplates.id, { onDelete: 'cascade' }),
  mappingId: integer('mapping_id')
    .notNull()
    .references(() => formMappings.id, { onDelete: 'cascade' }),
  companyId: integer('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  // "Last editor" attribution only — any company member may edit a shared
  // response, so this reflects who touched it most recently, not an owner.
  lastEditedByUserId: integer('last_edited_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  responseJson: jsonb('response_json').notNull().default({}),
  status: text('status').notNull().default('draft'), // 'draft' | 'submitted'
  submittedAt: timestamp('submitted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type FormResponse = typeof formResponses.$inferSelect
export type NewFormResponse = typeof formResponses.$inferInsert
