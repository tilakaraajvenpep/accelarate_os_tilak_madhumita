import type { FormQuestion } from '../models'

/**
 * Rolls up a submitted response against its form's rubric — only single_choice/
 * dropdown/multiple_choice questions carry option scores (FormQuestion.options[].score),
 * so every other question type (text/number/date/editable_table) is skipped rather
 * than treated as unscored-zero.
 */
export interface FormScoreResult {
  score: number
  maxScore: number
  scorePercentage: number | null
}

export function computeFormScore(schema: FormQuestion[], responseJson: Record<string, unknown>): FormScoreResult {
  let score = 0
  let maxScore = 0

  for (const question of schema) {
    if (!question.options || question.options.length === 0) continue

    if (question.type === 'multiple_choice') {
      const positiveOptions = question.options.filter((o) => o.score > 0)
      maxScore += positiveOptions.reduce((sum, o) => sum + o.score, 0)
      const selected = Array.isArray(responseJson[question.id]) ? (responseJson[question.id] as unknown[]) : []
      for (const label of selected) {
        const option = question.options.find((o) => o.label === label)
        if (option) score += option.score
      }
    } else if (question.type === 'single_choice' || question.type === 'dropdown') {
      maxScore += Math.max(0, ...question.options.map((o) => o.score))
      const option = question.options.find((o) => o.label === responseJson[question.id])
      if (option) score += option.score
    }
  }

  const choicePercentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : null

  let aiPercentage: number | null = null
  if (typeof responseJson?._overallAiScore === 'number') {
    aiPercentage = responseJson._overallAiScore
  } else if (responseJson?._aiScores && typeof responseJson._aiScores === 'object') {
    const rawScores = responseJson._aiScores as Record<string, { score?: number }>
    const scores = Object.values(rawScores)
      .map((s) => (s && typeof s.score === 'number' ? s.score : null))
      .filter((s): s is number => s !== null)
    if (scores.length > 0) {
      aiPercentage = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    }
  }

  let scorePercentage: number | null = null
  if (choicePercentage !== null && aiPercentage !== null) {
    scorePercentage = Math.round((choicePercentage + aiPercentage) / 2)
  } else if (choicePercentage !== null) {
    scorePercentage = choicePercentage
  } else if (aiPercentage !== null) {
    scorePercentage = aiPercentage
  }

  return { score, maxScore, scorePercentage }
}

