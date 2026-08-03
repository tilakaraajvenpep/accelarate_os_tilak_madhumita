import OpenAI from 'openai'
import { getActiveProviderConfig, getTenantPlanProviderConfig } from '../ai-provider-configs.service'
import { decryptSecret } from '../../utils/encryption'

const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'

/**
 * Resolves the OpenAI client to use for AI features. Prefers a key assigned to the
 * tenant's subscription plan; falls back to active platform key in ai_provider_configs,
 * and then to OPENAI_API_KEY from process.env. Returns null if none is available.
 */
export async function getOpenAiClient(tenantId?: number): Promise<{ client: OpenAI; model: string } | null> {
  let config = tenantId ? await getTenantPlanProviderConfig(tenantId, 'openai') : null
  if (!config) {
    config = await getActiveProviderConfig('openai')
  }
  if (config) {
    return {
      client: new OpenAI({ apiKey: decryptSecret(config.apiKeyCiphertext) }),
      model: config.model || DEFAULT_OPENAI_MODEL,
    }
  }

  const envKey = process.env.OPENAI_API_KEY
  if (envKey && envKey.trim() !== '') {
    return { client: new OpenAI({ apiKey: envKey }), model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL }
  }

  return null
}
