import { pgTable, serial, integer, text, jsonb, timestamp, unique } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'
import { governanceConfigs } from './governance-config.model'
import { companies } from './company.model'

// One company's governance review cycle against a given config: founder
// submits notes (which snapshots the company's raw pillar/form data into
// rawData), a mentor/admin reviews it, and — once reviewed — an AI-generated
// PDF report can be produced from that snapshot and stored inline (base64,
// same no-S3 tradeoff as cohort_documents.file_data) for download.
export const governanceSessions = pgTable(
  'governance_sessions',
  {
    id: serial('id').primaryKey(),
    tenantId: integer('tenant_id')
      .notNull()
      .references(() => tenants.id),
    configId: integer('config_id')
      .notNull()
      .references(() => governanceConfigs.id, { onDelete: 'cascade' }),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('draft'), // 'draft' | 'submitted' | 'reviewed'
    rawData: jsonb('raw_data').notNull().default({}),
    founderNotes: text('founder_notes'),
    feedback: text('feedback'),
    outcome: text('outcome'),
    documentPdfData: text('document_pdf_data'), // base64
    documentGeneratedAt: timestamp('document_generated_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [unique().on(table.configId, table.companyId)],
)

export type GovernanceSession = typeof governanceSessions.$inferSelect
export type NewGovernanceSession = typeof governanceSessions.$inferInsert
