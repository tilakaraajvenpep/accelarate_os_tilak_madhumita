import { pgTable, serial, integer, jsonb, timestamp } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'

/** What a brand-new tenant's first admin submitted on the /get-started "organization details" step, when the platform-wide custom onboarding form is enabled. One row per tenant. */
export const tenantOnboardingResponses = pgTable('tenant_onboarding_responses', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().unique().references(() => tenants.id, { onDelete: 'cascade' }),
  responseJson: jsonb('response_json').notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type TenantOnboardingResponse = typeof tenantOnboardingResponses.$inferSelect
export type NewTenantOnboardingResponse = typeof tenantOnboardingResponses.$inferInsert
