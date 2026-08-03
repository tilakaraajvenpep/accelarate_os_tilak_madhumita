import { pgTable, serial, text, integer, timestamp, unique } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'

// Purely a display-name lookup for a pillar number — never gates access.
// Pillars themselves are dynamic: whatever distinct contextId values exist
// among a tenant's active pillar_diagnostic mappings (see pillars.service.ts).
export const pillarDefinitions = pgTable(
  'pillar_definitions',
  {
    id: serial('id').primaryKey(),
    tenantId: integer('tenant_id')
      .notNull()
      .references(() => tenants.id),
    pillarNumber: integer('pillar_number').notNull(),
    title: text('title'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [unique().on(table.tenantId, table.pillarNumber)],
)

export type PillarDefinition = typeof pillarDefinitions.$inferSelect
export type NewPillarDefinition = typeof pillarDefinitions.$inferInsert
