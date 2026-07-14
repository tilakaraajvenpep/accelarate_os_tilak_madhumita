import type { AiProvider } from '@/types/ai-provider'

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Claude (Anthropic)',
}
