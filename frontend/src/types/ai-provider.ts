export type AiProvider = 'openai' | 'anthropic' | 'manus'

export interface AiProviderConfig {
  id: number
  provider: AiProvider
  apiKeyLastFour: string
  enabled: boolean
  createdAt: string
}
