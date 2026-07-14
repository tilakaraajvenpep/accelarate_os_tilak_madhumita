export const AI_PROVIDERS = ['openai', 'anthropic'] as const
export type AiProvider = (typeof AI_PROVIDERS)[number]

/**
 * Curated model lists shown in the "add AI key" UI. Update as providers
 * release new models — this is the single place that needs editing.
 */
export const AI_PROVIDER_MODELS: Record<AiProvider, string[]> = {
  openai: ['gpt-5.1', 'gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt-4o', 'o4-mini'],
  anthropic: [
    'claude-fable-5',
    'claude-opus-4-8',
    'claude-sonnet-5',
    'claude-haiku-4-5',
  ],
}

export function isValidProvider(value: string): value is AiProvider {
  return (AI_PROVIDERS as readonly string[]).includes(value)
}
