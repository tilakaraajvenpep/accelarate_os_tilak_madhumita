import { eq, and } from 'drizzle-orm'
import { db } from '../db/client'
import { aiProviderConfigs } from '../models'
import { encryptSecret } from '../config/crypto'
import { AI_PROVIDER_MODELS, type AiProvider } from '../config/ai-provider-models'

function toPublicConfig(row: typeof aiProviderConfigs.$inferSelect) {
  return {
    id: row.id,
    provider: row.provider,
    model: row.model,
    apiKeyLastFour: row.apiKeyLastFour,
    enabled: row.enabled,
    createdAt: row.createdAt,
  }
}

export async function listAiProviderConfigs() {
  const rows = await db.select().from(aiProviderConfigs).orderBy(aiProviderConfigs.createdAt)
  return rows.map(toPublicConfig)
}

export async function createAiProviderConfig(provider: AiProvider, model: string, apiKey: string) {
  if (!AI_PROVIDER_MODELS[provider]?.includes(model)) {
    throw new Error(`Unknown model "${model}" for provider "${provider}"`)
  }

  const apiKeyCiphertext = encryptSecret(apiKey)
  const apiKeyLastFour = apiKey.slice(-4)

  const [existing] = await db
    .select()
    .from(aiProviderConfigs)
    .where(and(eq(aiProviderConfigs.provider, provider), eq(aiProviderConfigs.model, model)))
    .limit(1)

  if (existing) {
    const [updated] = await db
      .update(aiProviderConfigs)
      .set({ apiKeyCiphertext, apiKeyLastFour, enabled: true, updatedAt: new Date() })
      .where(eq(aiProviderConfigs.id, existing.id))
      .returning()
    return toPublicConfig(updated)
  }

  const [created] = await db
    .insert(aiProviderConfigs)
    .values({ provider, model, apiKeyCiphertext, apiKeyLastFour })
    .returning()
  return toPublicConfig(created)
}

export async function updateAiProviderConfig(id: number, data: { model?: string; apiKey?: string }) {
  const [existing] = await db.select().from(aiProviderConfigs).where(eq(aiProviderConfigs.id, id)).limit(1)
  if (!existing) throw new Error('AI provider config not found')

  if (data.model && !AI_PROVIDER_MODELS[existing.provider]?.includes(data.model)) {
    throw new Error(`Unknown model "${data.model}" for provider "${existing.provider}"`)
  }

  const updates: Partial<typeof aiProviderConfigs.$inferInsert> = {
    model: data.model ?? existing.model,
    updatedAt: new Date(),
  }
  if (data.apiKey) {
    updates.apiKeyCiphertext = encryptSecret(data.apiKey)
    updates.apiKeyLastFour = data.apiKey.slice(-4)
  }

  const [updated] = await db
    .update(aiProviderConfigs)
    .set(updates)
    .where(eq(aiProviderConfigs.id, id))
    .returning()
  return toPublicConfig(updated)
}

export async function setAiProviderConfigEnabled(id: number, enabled: boolean) {
  const [updated] = await db
    .update(aiProviderConfigs)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(aiProviderConfigs.id, id))
    .returning()
  if (!updated) throw new Error('AI provider config not found')
  return toPublicConfig(updated)
}

export async function deleteAiProviderConfig(id: number) {
  const [deleted] = await db.delete(aiProviderConfigs).where(eq(aiProviderConfigs.id, id)).returning()
  if (!deleted) throw new Error('AI provider config not found')
}
