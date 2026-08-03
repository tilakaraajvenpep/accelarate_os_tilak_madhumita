import { pgTable, serial, integer, timestamp } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'
import { companies } from './company.model'
import { pillars } from './pillar.model'
import { sections } from './section.model'

export const companyUnlocks = pgTable(
  'company_unlocks',
  {
    id: serial('id').primaryKey(),
    tenantId: integer('tenant_id').notNull().references(() => tenants.id),
    companyId: integer('company_id').notNull().references(() => companies.id),
    pillarId: integer('pillar_id').references(() => pillars.id),
    sectionId: integer('section_id').references(() => sections.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  }
)

export type CompanyUnlock = typeof companyUnlocks.$inferSelect
export type NewCompanyUnlock = typeof companyUnlocks.$inferInsert
