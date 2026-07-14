export type AiProvider = 'openai' | 'anthropic'

export interface AiProviderConfig {
  id: number
  provider: AiProvider
  model: string
  apiKeyLastFour: string
  enabled: boolean
  createdAt: string
}
