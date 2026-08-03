import { eq, and, inArray } from 'drizzle-orm'
import { db } from '../db/client'
import { pillarChecklistResponses } from '../models'

export async function getPillarChecklistResponses(tenantId: number, companyId: number, questionIds: number[]) {
  if (questionIds.length === 0) return []
  return db
    .select()
    .from(pillarChecklistResponses)
    .where(and(eq(pillarChecklistResponses.tenantId, tenantId), eq(pillarChecklistResponses.companyId, companyId), inArray(pillarChecklistResponses.questionId, questionIds)))
}

export async function savePillarChecklistResponses(
  tenantId: number,
  companyId: number,
  answers: Array<{ questionId: number; answerText?: string | null; answerBool?: boolean | null }>,
) {
  return db.transaction(async (tx) => {
    const results = []
    for (const answer of answers) {
      const [existing] = await tx
        .select({ id: pillarChecklistResponses.id })
        .from(pillarChecklistResponses)
        .where(and(eq(pillarChecklistResponses.companyId, companyId), eq(pillarChecklistResponses.questionId, answer.questionId)))
        .limit(1)
      if (existing) {
        const [updated] = await tx
          .update(pillarChecklistResponses)
          .set({ answerText: answer.answerText ?? null, answerBool: answer.answerBool ?? null, updatedAt: new Date() })
          .where(eq(pillarChecklistResponses.id, existing.id))
          .returning()
        results.push(updated)
      } else {
        const [created] = await tx
          .insert(pillarChecklistResponses)
          .values({ tenantId, companyId, questionId: answer.questionId, answerText: answer.answerText ?? null, answerBool: answer.answerBool ?? null })
          .returning()
        results.push(created)
      }
    }
    return results
  })
}
