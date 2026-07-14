import { pgTable, serial, text, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core'

export const aiProviderEnum = pgEnum('ai_provider', ['openai', 'anthropic'])

export const aiProviderConfigs = pgTable('ai_provider_configs', {
  id: serial('id').primaryKey(),
  provider: aiProviderEnum('provider').notNull(),
  model: text('model').notNull(),
  apiKeyCiphertext: text('api_key_ciphertext').notNull(),
  apiKeyLastFour: text('api_key_last_four').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type AiProviderConfig = typeof aiProviderConfigs.$inferSelect
export type NewAiProviderConfig = typeof aiProviderConfigs.$inferInsert
