import { eq, desc } from 'drizzle-orm'
import { db } from '../db/client'
import { aiProviderConfigs } from '../models'
import { encryptSecret } from '../utils/encryption'

export async function listAiProviderConfigs() {
  return db
    .select({
      id: aiProviderConfigs.id,
      provider: aiProviderConfigs.provider,
      model: aiProviderConfigs.model,
      apiKeyLastFour: aiProviderConfigs.apiKeyLastFour,
      enabled: aiProviderConfigs.enabled,
      createdAt: aiProviderConfigs.createdAt,
    })
    .from(aiProviderConfigs)
    .orderBy(desc(aiProviderConfigs.createdAt))
}

export async function createAiProviderConfig(data: { provider: 'openai' | 'anthropic'; model: string; apiKey: string }) {
  const [created] = await db
    .insert(aiProviderConfigs)
    .values({
      provider: data.provider,
      model: data.model,
      apiKeyCiphertext: encryptSecret(data.apiKey),
      apiKeyLastFour: data.apiKey.slice(-4),
    })
    .returning({
      id: aiProviderConfigs.id,
      provider: aiProviderConfigs.provider,
      model: aiProviderConfigs.model,
      apiKeyLastFour: aiProviderConfigs.apiKeyLastFour,
      enabled: aiProviderConfigs.enabled,
      createdAt: aiProviderConfigs.createdAt,
    })
  return created
}

export async function updateAiProviderConfig(id: number, data: { model?: string; apiKey?: string }) {
  const update: Partial<typeof aiProviderConfigs.$inferInsert> = { updatedAt: new Date() }
  if (data.model) update.model = data.model
  if (data.apiKey) {
    update.apiKeyCiphertext = encryptSecret(data.apiKey)
    update.apiKeyLastFour = data.apiKey.slice(-4)
  }

  const [updated] = await db
    .update(aiProviderConfigs)
    .set(update)
    .where(eq(aiProviderConfigs.id, id))
    .returning({
      id: aiProviderConfigs.id,
      provider: aiProviderConfigs.provider,
      model: aiProviderConfigs.model,
      apiKeyLastFour: aiProviderConfigs.apiKeyLastFour,
      enabled: aiProviderConfigs.enabled,
      createdAt: aiProviderConfigs.createdAt,
    })
  if (!updated) throw new Error('AI provider key not found')
  return updated
}

export async function setAiProviderConfigEnabled(id: number, enabled: boolean) {
  const [updated] = await db
    .update(aiProviderConfigs)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(aiProviderConfigs.id, id))
    .returning({ id: aiProviderConfigs.id, enabled: aiProviderConfigs.enabled })
  if (!updated) throw new Error('AI provider key not found')
  return updated
}

export async function deleteAiProviderConfig(id: number) {
  const [deleted] = await db.delete(aiProviderConfigs).where(eq(aiProviderConfigs.id, id)).returning()
  if (!deleted) throw new Error('AI provider key not found')
}
