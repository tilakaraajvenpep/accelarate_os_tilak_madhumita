import { getOpenAiClient } from './ai/provider-client'
import { hasAvailableCredits, spendAiCredits } from './ai-credits.service'

export interface AnswerScore {
  score: number
  color: 'red' | 'yellow' | 'green'
  feedback: string
  reasoning: string
  rephrasedAnswer: string
}

const SYSTEM_PROMPT = `You are an expert startup evaluator. Analyze the quality of the founder's answer to the given question.
Return a JSON object ONLY with the following keys. Do NOT include markdown code blocks, just raw JSON:
- "score": a number between 0 and 100 representing the strength/quality.
- "color": one of "red" (score < 40), "yellow" (score 40-70), or "green" (score > 70).
- "feedback": a very short (max 5 words) strength assessment (e.g. "Weak", "Good Start", "Excellent").
- "reasoning": one or two sentences explaining what drives the score — what's strong, what's missing.
- "rephrased_answer": a professionally rewritten version of the founder's answer that keeps their facts and intent but improves clarity, structure, and impact.`

function fallbackScore(answer: string): AnswerScore {
  const wordCount = answer.trim().split(/\s+/).length
  if (wordCount < 10) {
    return {
      score: 30,
      color: 'red',
      feedback: 'Weak Response',
      reasoning: 'The answer is brief — add more specific detail to strengthen it.',
      rephrasedAnswer: answer,
    }
  }
  if (wordCount > 35) {
    return {
      score: 85,
      color: 'green',
      feedback: 'Highly Comprehensive',
      reasoning: 'The answer is detailed and covers the question thoroughly.',
      rephrasedAnswer: answer,
    }
  }
  return {
    score: 55,
    color: 'yellow',
    feedback: 'Good Start',
    reasoning: 'The answer covers the basics but could use more specific detail.',
    rephrasedAnswer: answer,
  }
}

export async function scoreAnswer(tenantId: number | null, question: string, answer: string): Promise<AnswerScore> {
  if (answer.trim().length < 5) {
    return { score: 10, color: 'red', feedback: 'Too Short', reasoning: 'The answer is too short to evaluate.', rephrasedAnswer: answer }
  }

  const resolved = await getOpenAiClient(tenantId ?? undefined)
  // Scoring is best-effort and must never block form-filling — insufficient credits degrades
  // to the same offline heuristic used when no AI provider is configured at all, no error surfaced.
  const canAfford = resolved && (!tenantId || (await hasAvailableCredits(tenantId)))
  if (canAfford) {
    try {
      const response = await resolved.client.chat.completions.create({
        model: resolved.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Question: "${question}"\nAnswer: "${answer}"` },
        ],
        temperature: 0.3,
      })
      const text = response.choices[0]?.message?.content || ''
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(cleanText)
      if (
        typeof parsed.score === 'number' &&
        (parsed.color === 'red' || parsed.color === 'yellow' || parsed.color === 'green') &&
        typeof parsed.feedback === 'string'
      ) {
        if (tenantId && response.usage?.total_tokens) {
          await spendAiCredits(tenantId, response.usage.total_tokens)
        }
        return {
          score: parsed.score,
          color: parsed.color,
          feedback: parsed.feedback,
          reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
          rephrasedAnswer: typeof parsed.rephrased_answer === 'string' ? parsed.rephrased_answer : answer,
        }
      }
    } catch (err) {
      console.error('[ai-scoring.service] Error calling OpenAI:', err)
    }
  }

  return fallbackScore(answer)
}
