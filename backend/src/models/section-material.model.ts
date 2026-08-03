import { pgTable, serial, integer, text, timestamp } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'
import { companies } from './company.model'
import { sections } from './section.model'
import { users } from './user.model'

// Company-team-uploaded reference material scoped to one section — same
// access model as pillar_materials, just section-scoped instead of pillar-scoped.
export const sectionMaterials = pgTable('section_materials', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id),
  companyId: integer('company_id').notNull().references(() => companies.id),
  sectionId: integer('section_id').notNull().references(() => sections.id),
  title: text('title').notNull(),
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(),
  fileData: text('file_data').notNull(),
  fileSize: integer('file_size').notNull(),
  uploadedByUserId: integer('uploaded_by_user_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type SectionMaterial = typeof sectionMaterials.$inferSelect
export type NewSectionMaterial = typeof sectionMaterials.$inferInsert
