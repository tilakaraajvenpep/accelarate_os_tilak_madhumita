import { pgTable, serial, integer, timestamp, unique } from 'drizzle-orm/pg-core'
import { plans } from './plan.model'
import { aiProviderConfigs } from './ai-provider-config.model'

// Which AI provider key(s) a plan's tenants should use for the chatbot,
// instead of the platform-wide default in ai/provider-client.ts. sortOrder
// breaks ties when more than one usable (openai, enabled) key is assigned —
// lowest wins. See ai-credits.service.ts's resolveChatOpenAiClient.
export const planAiProviderConfigs = pgTable(
  'plan_ai_provider_configs',
  {
    id: serial('id').primaryKey(),
    planId: integer('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    aiProviderConfigId: integer('ai_provider_config_id')
      .notNull()
      .references(() => aiProviderConfigs.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [unique().on(table.planId, table.aiProviderConfigId)],
)

export type PlanAiProviderConfig = typeof planAiProviderConfigs.$inferSelect
export type NewPlanAiProviderConfig = typeof planAiProviderConfigs.$inferInsert
