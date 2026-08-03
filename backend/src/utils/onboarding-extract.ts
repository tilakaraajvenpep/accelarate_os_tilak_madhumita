/**
 * Best-effort field extraction from a custom onboarding form's response —
 * used when a tenant-mapped Assessment Form (or, for tenant onboarding, the
 * platform-wide simple form) replaces one of the app's hardcoded onboarding
 * fields (company name, founder name, mentor specialization, tenant org
 * name/type/website). The admin who built the form isn't required to follow
 * any strict question-id contract; this just looks for a question whose id
 * or title contains all the given keywords and reads its (string) answer,
 * falling back to a sensible default if nothing matches. The raw response is
 * always saved in full alongside this best-effort value, so nothing is lost
 * even when the heuristic misses. Structurally typed (id+title only) so it
 * works for both FormQuestion and the simpler SimpleFormQuestion.
 */
function findAnswerByKeywords(
  schema: { id: string; title: string }[],
  responseJson: Record<string, unknown>,
  keywordGroups: string[][],
  excludeQuestionId?: string,
): { questionId: string; value: string } | null {
  for (const keywords of keywordGroups) {
    const question = schema.find((q) => {
      if (q.id === excludeQuestionId) return false
      const haystack = `${q.id} ${q.title}`.toLowerCase()
      return keywords.every((k) => haystack.includes(k))
    })
    if (question) {
      const value = responseJson[question.id]
      if (typeof value === 'string' && value.trim().length > 0) return { questionId: question.id, value: value.trim() }
    }
  }
  return null
}

/**
 * Resolves one field via progressively looser keyword groups, then (if still
 * nothing) any question whose id/title merely contains "name" — the admin's
 * custom form isn't required to phrase a question exactly like "Founder name",
 * a bare "Your name" should still be recognized rather than silently falling
 * through to the email fallback below. excludeQuestionId keeps two different
 * fields (e.g. company name vs founder name) from both latching onto the same
 * single "name" question when a form only has one.
 */
function resolveNameField(
  schema: { id: string; title: string }[],
  responseJson: Record<string, unknown>,
  strictGroups: string[][],
  excludeQuestionId?: string,
): { questionId: string; value: string } | null {
  return (
    findAnswerByKeywords(schema, responseJson, strictGroups, excludeQuestionId) ??
    findAnswerByKeywords(schema, responseJson, [['name']], excludeQuestionId)
  )
}

export function extractSpecializationFromResponse(schema: { id: string; title: string }[], responseJson: Record<string, unknown>) {
  return findAnswerByKeywords(schema, responseJson, [['specializ'], ['expertise'], ['area', 'focus']])?.value ?? null
}

export function extractOrgFieldsFromResponse(schema: { id: string; title: string }[], responseJson: Record<string, unknown>, fallbackOrgName: string) {
  const orgName = resolveNameField(schema, responseJson, [['organization', 'name'], ['organisation', 'name'], ['company', 'name']])?.value ?? fallbackOrgName
  const website = findAnswerByKeywords(schema, responseJson, [['website'], ['url']])?.value ?? null
  return { orgName, website }
}
