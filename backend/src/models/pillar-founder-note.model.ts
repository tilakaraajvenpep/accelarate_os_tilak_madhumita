import { pgTable, serial, integer, text, timestamp, unique } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'
import { companies } from './company.model'
import { pillars } from './pillar.model'

// One "key takeaways" free-text note per company per pillar — upserted, no history.
export const pillarFounderNotes = pgTable(
  'pillar_founder_notes',
  {
    id: serial('id').primaryKey(),
    tenantId: integer('tenant_id').notNull().references(() => tenants.id),
    companyId: integer('company_id').notNull().references(() => companies.id),
    pillarId: integer('pillar_id').notNull().references(() => pillars.id),
    keyTakeaways: text('key_takeaways').notNull().default(''),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [unique().on(table.companyId, table.pillarId)],
)

export type PillarFounderNote = typeof pillarFounderNotes.$inferSelect
export type NewPillarFounderNote = typeof pillarFounderNotes.$inferInsert
