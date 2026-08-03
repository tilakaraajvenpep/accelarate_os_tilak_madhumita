import { pgTable, serial, boolean, integer, text, timestamp } from 'drizzle-orm/pg-core'
import { tenants } from './tenant.model'

export const platformSettings = pgTable('platform_settings', {
  id: serial('id').primaryKey(),
  allowExpiryOverride: boolean('allow_expiry_override').notNull().default(true),
  defaultGraceDays: integer('default_grace_days').notNull().default(0),
  defaultCurrency: text('default_currency').notNull().default('usd'),
  aiCreditRateCents: integer('ai_credit_rate_cents').notNull().default(100),
  aiFormGenerationCostCredits: integer('ai_form_generation_cost_credits').notNull().default(5),
  // Converts real OpenAI token usage into credits spent — see ai-credits.service.ts.
  aiCreditsPerThousandTokens: integer('ai_credits_per_thousand_tokens').notNull().default(10),
  // Which tenant's 'tenant_admin_onboarding' Forms > Mappings entry supplies
  // the custom form shown on the public /get-started "organization details"
  // step — chosen by super admin (a single tenant picker, not a schema
  // editor), since no tenant exists yet at that point to scope one to.
  // Null = that step uses the default name/type/website fields.
  tenantOnboardingSourceTenantId: integer('tenant_onboarding_source_tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type PlatformSettings = typeof platformSettings.$inferSelect
export type NewPlatformSettings = typeof platformSettings.$inferInsert
