import { pgTable, serial, integer, timestamp, unique } from 'drizzle-orm/pg-core'
import { pillars } from './pillar.model'
import { sections } from './section.model'

/** Section Mapping — which sections belong to which pillar, and their drag-and-drop order within it. */
export const pillarSections = pgTable(
  'pillar_sections',
  {
    id: serial('id').primaryKey(),
    pillarId: integer('pillar_id')
      .notNull()
      .references(() => pillars.id),
    sectionId: integer('section_id')
      .notNull()
      .references(() => sections.id),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pillarSectionUnique: unique().on(table.pillarId, table.sectionId),
  }),
)

export type PillarSection = typeof pillarSections.$inferSelect
export type NewPillarSection = typeof pillarSections.$inferInsert
