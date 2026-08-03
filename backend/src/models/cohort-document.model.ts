import { pgTable, serial, integer, text, timestamp } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'
import { cohorts } from './cohort.model'
import { users } from './user.model'

// Admin/mentor-uploaded reference documents for a cohort (e.g. handbooks,
// templates) — stored as a base64 data URL, same no-S3 tradeoff as the
// tenant logo (see tenants.service.ts). Founders can view but never upload.
export const cohortDocuments = pgTable('cohort_documents', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id),
  cohortId: integer('cohort_id').notNull().references(() => cohorts.id),
  title: text('title').notNull(),
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(),
  fileData: text('file_data').notNull(),
  fileSize: integer('file_size').notNull(),
  uploadedByUserId: integer('uploaded_by_user_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type CohortDocument = typeof cohortDocuments.$inferSelect
export type NewCohortDocument = typeof cohortDocuments.$inferInsert
