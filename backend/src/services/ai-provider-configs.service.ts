import { eq, and, desc, inArray } from 'drizzle-orm'
import { db } from '../db/client'
import { aiProviderConfigs, subscriptions, planAiProviderConfigs } from '../models'
import { encryptSecret } from '../utils/encryption'

/** Full row (incl. ciphertext) for the AI provider key assigned to the tenant's plan, or null if none. */
export async function getTenantPlanProviderConfig(tenantId: number, provider: 'openai' | 'anthropic' | 'manus') {
  const [sub] = await db
    .select({ planId: subscriptions.planId })
    .from(subscriptions)
    .where(and(eq(subscriptions.tenantId, tenantId), inArray(subscriptions.status, ['active', 'trialing'])))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1)

  if (!sub?.planId) return null

  const [config] = await db
    .select({
      id: aiProviderConfigs.id,
      provider: aiProviderConfigs.provider,
      model: aiProviderConfigs.model,
      apiKeyCiphertext: aiProviderConfigs.apiKeyCiphertext,
      apiKeyLastFour: aiProviderConfigs.apiKeyLastFour,
      enabled: aiProviderConfigs.enabled,
      createdAt: aiProviderConfigs.createdAt,
      updatedAt: aiProviderConfigs.updatedAt,
    })
    .from(planAiProviderConfigs)
    .innerJoin(aiProviderConfigs, eq(planAiProviderConfigs.aiProviderConfigId, aiProviderConfigs.id))
    .where(
      and(
        eq(planAiProviderConfigs.planId, sub.planId),
        eq(aiProviderConfigs.provider, provider),
        eq(aiProviderConfigs.enabled, true),
      ),
    )
    .orderBy(planAiProviderConfigs.sortOrder)
    .limit(1)

  return config ?? null
}

/** Full row (incl. ciphertext) for the most recently created enabled config for a provider, or null if none. */
export async function getActiveProviderConfig(provider: 'openai' | 'anthropic' | 'manus') {
  const [config] = await db
    .select()
    .from(aiProviderConfigs)
    .where(and(eq(aiProviderConfigs.provider, provider), eq(aiProviderConfigs.enabled, true)))
    .orderBy(desc(aiProviderConfigs.createdAt))
    .limit(1)
  return config ?? null
}

export async function listAiProviderConfigs() {
  return db
    .select({
      id: aiProviderConfigs.id,
      provider: aiProviderConfigs.provider,
      apiKeyLastFour: aiProviderConfigs.apiKeyLastFour,
      enabled: aiProviderConfigs.enabled,
      createdAt: aiProviderConfigs.createdAt,
    })
    .from(aiProviderConfigs)
    .orderBy(desc(aiProviderConfigs.createdAt))
}

export async function createAiProviderConfig(data: { provider: 'openai' | 'anthropic' | 'manus'; apiKey: string }) {
  const [created] = await db
    .insert(aiProviderConfigs)
    .values({
      provider: data.provider,
      apiKeyCiphertext: encryptSecret(data.apiKey),
      apiKeyLastFour: data.apiKey.slice(-4),
    })
    .returning({
      id: aiProviderConfigs.id,
      provider: aiProviderConfigs.provider,
      apiKeyLastFour: aiProviderConfigs.apiKeyLastFour,
      enabled: aiProviderConfigs.enabled,
      createdAt: aiProviderConfigs.createdAt,
    })
  return created
}

export async function updateAiProviderConfig(id: number, data: { apiKey?: string }) {
  const update: Partial<typeof aiProviderConfigs.$inferInsert> = { updatedAt: new Date() }
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
