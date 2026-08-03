import { eq, and, inArray, isNull, or, asc } from 'drizzle-orm'
import { db } from '../db/client'
import { cohortTasks, programs, pillars, sections, pillarSections, sectionForms, formTemplates, cohorts, companies, users, companyUnlocks, type FormQuestion } from '../models'
import { listAllResponsesForSections, listManuallyCompletedSections, getSectionFormResponse } from './section-form-responses.service'
import { listMentorAssignments } from './cohort-pillar-mentors.service'
import { computeFormScore } from './form-scoring'

/**
 * A company can see a program once its cohort has at least one cohort_tasks
 * row referencing that program — i.e. an admin has scheduled a calendar-
 * enabled pillar/section from it onto that cohort (see
 * programs.service.ts's assignProgramToCohort). There's no separate
 * "enrollment" table — the calendar assignment doubles as enrollment.
 */
export async function listAssignedProgramsForCompany(tenantId: number, cohortId: number, companyId: number) {
  const rows = await db
    .selectDistinct({
      id: programs.id,
      name: programs.name,
      description: programs.description,
      status: programs.status,
    })
    .from(cohortTasks)
    .innerJoin(programs, eq(cohortTasks.programId, programs.id))
    .where(
      and(
        eq(cohortTasks.tenantId, tenantId),
        eq(cohortTasks.cohortId, cohortId),
        or(isNull(cohortTasks.companyId), eq(cohortTasks.companyId, companyId)),
        eq(programs.locked, false),
      ),
    )

  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      completed: (await getAssignedProgramDetailForCompany(tenantId, cohortId, companyId, row.id))?.completed ?? false,
    })),
  )
}

/**
 * Attaches each section's assigned forms (with per-company submitted state)
 * and a `completed` flag. A locked section is still shown (per row) but
 * carries no forms and never counts as completed. A section with no forms at
 * all needs an explicit "mark as done" (see markSectionComplete) instead of
 * completing silently.
 *
 * When `viewer` is passed (the founder actually viewing their own program —
 * never set for mentor/admin/aggregate call sites, which don't need
 * per-team-member gating), each form also gets `access` ('fillable' |
 * 'locked' | 'view_only') and, if locked, `claimedByName` — mirroring
 * cohort_form_responses' fill-policy resolution (see
 * resolveSectionFormAccess in section-form-responses.service.ts), computed in
 * bulk here rather than per-form to avoid N+1 queries.
 */
async function attachFormsAndCompletion<T extends { id: number; locked: boolean }>(
  tenantId: number,
  companyId: number,
  sectionRows: T[],
  viewer?: { userId: number; founderUserId: number | null },
) {
  if (sectionRows.length === 0) return []
  const sectionIds = sectionRows.map((s) => s.id)

  const formLinks = await db
    .select({ sectionId: sectionForms.sectionId, formId: formTemplates.id, formName: formTemplates.title, fillPolicy: sectionForms.fillPolicy })
    .from(sectionForms)
    .innerJoin(formTemplates, eq(sectionForms.formId, formTemplates.id))
    .where(inArray(sectionForms.sectionId, sectionIds))

  // Every attempt (branch) of every response, oldest-first per (sectionId, formId) — the single
  // bulk fetch both "current state" (its last entry) and the full attempt history are built from.
  const allResponses = await listAllResponsesForSections(tenantId, companyId, sectionIds)
  const responsesByKey = new Map<string, typeof allResponses>()
  for (const r of allResponses) {
    const key = `${r.sectionId}-${r.formId}`
    if (!responsesByKey.has(key)) responsesByKey.set(key, [])
    responsesByKey.get(key)!.push(r)
  }

  const manuallyCompleted = await listManuallyCompletedSections(tenantId, companyId, sectionIds)
  const manuallyCompletedSet = new Set(manuallyCompleted.map((s) => s.sectionId))

  const schemaCache = new Map<number, FormQuestion[]>()
  async function schemaFor(formId: number) {
    if (!schemaCache.has(formId)) {
      const [template] = await db.select({ schema: formTemplates.schema }).from(formTemplates).where(eq(formTemplates.id, formId)).limit(1)
      schemaCache.set(formId, (template?.schema as FormQuestion[]) ?? [])
    }
    return schemaCache.get(formId)!
  }

  type FormAttempt = {
    branchNumber: number
    status: 'draft' | 'submitted'
    submittedAt: Date | null
    scorePercentage: number | null
    hasDocument: boolean
  }
  type FormEntry = {
    id: number
    name: string
    submitted: boolean
    status: 'not_started' | 'draft' | 'submitted'
    access?: 'fillable' | 'locked' | 'view_only'
    claimedByName?: string | null
    lockedByUserId?: number | null
    scorePercentage: number | null
    submittedAt: Date | null
    hasDocument: boolean
    attempts: FormAttempt[]
  }
  const formsBySection = new Map<number, FormEntry[]>()
  const lockedFillerIds = new Set<number>()
  for (const link of formLinks) {
    if (!formsBySection.has(link.sectionId)) formsBySection.set(link.sectionId, [])
    const key = `${link.sectionId}-${link.formId}`
    const rows = responsesByKey.get(key) ?? []
    const schema = rows.length > 0 ? await schemaFor(link.formId) : []
    const attempts: FormAttempt[] = rows.map((r) => {
      const { scorePercentage } = computeFormScore(schema, r.responseJson as Record<string, unknown>)
      return {
        branchNumber: r.branchNumber,
        status: r.status as 'draft' | 'submitted',
        submittedAt: r.submittedAt,
        scorePercentage,
        hasDocument: !!r.documentFileName,
      }
    })
    const latest = rows[rows.length - 1]
    const status: 'not_started' | 'draft' | 'submitted' = latest ? (latest.status as 'draft' | 'submitted') : 'not_started'
    const submitted = latest?.status === 'submitted'

    const entry: FormEntry = {
      id: link.formId,
      name: link.formName,
      submitted,
      status,
      scorePercentage: attempts[attempts.length - 1]?.scorePercentage ?? null,
      hasDocument: attempts[attempts.length - 1]?.hasDocument ?? false,
      submittedAt: latest?.submittedAt ?? null,
      attempts,
    }

    if (viewer) {
      const filler = link.fillPolicy === 'primary_founder' ? viewer.founderUserId : (latest?.claimedByUserId ?? null)
      const isFiller = filler === null || filler === viewer.userId
      entry.access = status === 'submitted' ? 'view_only' : isFiller ? 'fillable' : 'locked'
      if (entry.access === 'locked' && filler !== null) {
        entry.lockedByUserId = filler
        lockedFillerIds.add(filler)
      }
    }

    formsBySection.get(link.sectionId)!.push(entry)
  }

  if (lockedFillerIds.size > 0) {
    const fillerNames = new Map<number, string | null>()
    const rows = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, [...lockedFillerIds]))
    for (const row of rows) fillerNames.set(row.id, row.name || row.email)
    for (const forms of formsBySection.values()) {
      for (const form of forms) {
        if (form.lockedByUserId != null) form.claimedByName = fillerNames.get(form.lockedByUserId) ?? null
      }
    }
  }

  return Promise.all(
    sectionRows.map(async (section) => {
      const assignedForms = (formsBySection.get(section.id) ?? []).map(({ lockedByUserId, ...form }) => form)
      const completed = section.locked
        ? false
        : assignedForms.length > 0
          ? assignedForms.every((f) => f.submitted)
          : manuallyCompletedSet.has(section.id)
      // Independent of pillar purpose/passThreshold gating — purely informational,
      // shown for every section regardless of the pillar's assessment/learning mode.
      const scorePercentage = await computeFormsScorePercentage(tenantId, companyId, [{ id: section.id, forms: assignedForms }])
      return { ...section, forms: assignedForms, completed, scorePercentage }
    }),
  )
}

/**
 * Rolls up every submitted form across a set of sections against its schema's scored
 * answer options and AI scores — see form-scoring.ts. Used both for a pillar's assessment-gating score
 * (all of its unlocked sections) and a single section's own informational score (just
 * that one section). Returns null when no question anywhere carries a score (nothing to
 * grade against) rather than an unwinnable 0/0.
 */
async function computeFormsScorePercentage(
  tenantId: number,
  companyId: number,
  sections: Array<{ id: number; forms: Array<{ id: number; submitted: boolean }> }>,
): Promise<number | null> {
  const percentages: number[] = []
  let totalScore = 0
  let totalMax = 0

  for (const section of sections) {
    for (const form of section.forms) {
      if (!form.submitted) continue
      const response = await getSectionFormResponse(tenantId, companyId, section.id, form.id)
      if (!response) continue
      const [template] = await db.select({ schema: formTemplates.schema }).from(formTemplates).where(eq(formTemplates.id, form.id)).limit(1)
      const schema = (template?.schema as FormQuestion[]) ?? []
      const res = computeFormScore(schema, response.responseJson as Record<string, unknown>)
      if (res.scorePercentage !== null) {
        percentages.push(res.scorePercentage)
      } else if (res.maxScore > 0) {
        totalScore += res.score
        totalMax += res.maxScore
      }
    }
  }

  if (percentages.length > 0) {
    return Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length)
  }
  return totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null
}

/**
 * `viewerUserId` should only ever be the founder actually viewing their own
 * program (see routes/founder-programs.ts) — it's what lets each section
 * form's fill-access be resolved against that specific team member. Every
 * other call site (mentor, admin "view as founder", progress aggregation)
 * omits it, since they don't need per-team-member gating.
 */
export async function getAssignedProgramDetailForCompany(tenantId: number, cohortId: number, companyId: number, programId: number, viewerUserId?: number) {
  const [program] = await db
    .select()
    .from(programs)
    .where(and(eq(programs.id, programId), eq(programs.tenantId, tenantId), eq(programs.locked, false)))
    .limit(1)
  if (!program) return null

  const assignedTasks = await db
    .select()
    .from(cohortTasks)
    .where(
      and(
        eq(cohortTasks.tenantId, tenantId),
        eq(cohortTasks.cohortId, cohortId),
        eq(cohortTasks.programId, programId),
        or(isNull(cohortTasks.companyId), eq(cohortTasks.companyId, companyId)),
      ),
    )
  if (assignedTasks.length === 0) return null // program was never scheduled onto this company's cohort

  const dateByPillarId = new Map(assignedTasks.filter((t) => t.pillarId !== null).map((t) => [t.pillarId as number, t.startDate]))
  const dateBySectionId = new Map(assignedTasks.filter((t) => t.sectionId !== null).map((t) => [t.sectionId as number, t.startDate]))

  const unlocks = await db
    .select()
    .from(companyUnlocks)
    .where(and(eq(companyUnlocks.tenantId, tenantId), eq(companyUnlocks.companyId, companyId)))

  const unlockedPillarIdsOverride = new Set(unlocks.map((u) => u.pillarId).filter((id): id is number => id !== null))
  const unlockedSectionIdsOverride = new Set(unlocks.map((u) => u.sectionId).filter((id): id is number => id !== null))

  // All pillars (locked included) so a locked one still shows up — just marked
  // locked and excluded from the completion calculation below.
  const allPillars = await db
    .select()
    .from(pillars)
    .where(and(eq(pillars.tenantId, tenantId), eq(pillars.programId, programId)))
    .orderBy(asc(pillars.sortOrder))

  const unlockedPillarIds = allPillars.filter((p) => !p.locked || unlockedPillarIdsOverride.has(p.id)).map((p) => p.id)
  const sectionLinks =
    unlockedPillarIds.length === 0
      ? []
      : await db
          .select({ pillarId: pillarSections.pillarId, sortOrder: pillarSections.sortOrder, section: sections })
          .from(pillarSections)
          .innerJoin(sections, eq(pillarSections.sectionId, sections.id))
          .where(inArray(pillarSections.pillarId, unlockedPillarIds))

  const sectionsByPillar = new Map<number, typeof sectionLinks>()
  for (const link of sectionLinks) {
    if (!sectionsByPillar.has(link.pillarId)) sectionsByPillar.set(link.pillarId, [])
    sectionsByPillar.get(link.pillarId)!.push(link)
  }

  let viewer: { userId: number; founderUserId: number | null } | undefined
  if (viewerUserId !== undefined) {
    const [company] = await db.select({ founderUserId: companies.founderUserId }).from(companies).where(and(eq(companies.id, companyId), eq(companies.tenantId, tenantId))).limit(1)
    viewer = { userId: viewerUserId, founderUserId: company?.founderUserId ?? null }
  }

  const pillarsWithCompletion = await Promise.all(
    allPillars.map(async (pillar) => {
      const isPillarUnlocked = unlockedPillarIdsOverride.has(pillar.id)
      const isLocked = pillar.locked && !isPillarUnlocked

      if (isLocked) {
        return { ...pillar, locked: true, scheduledDate: dateByPillarId.get(pillar.id) ?? null, sections: [], completed: false, scorePercentage: null, completionPercentage: 0 }
      }
      const sectionRows = (sectionsByPillar.get(pillar.id) ?? [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((link) => {
          const isSectionUnlocked = unlockedSectionIdsOverride.has(link.section.id)
          return {
            ...link.section,
            locked: link.section.locked && !isSectionUnlocked,
            scheduledDate: dateBySectionId.get(link.section.id) ?? null,
          }
        })
      const sectionsWithForms = await attachFormsAndCompletion(tenantId, companyId, sectionRows, viewer)
      const unlockedSections = sectionsWithForms.filter((s) => !s.locked)
      const allSubmitted = unlockedSections.every((s) => s.completed)

      let completed = allSubmitted
      let scorePercentage: number | null = null
      // No pass threshold set is a deliberate "informational scoring, no gate" mode —
      // completion still just follows submission, same as a learning pillar.
      if (pillar.purpose === 'assessment' && pillar.passThreshold !== null && allSubmitted) {
        scorePercentage = await computeFormsScorePercentage(tenantId, companyId, unlockedSections)
        completed = scorePercentage === null || scorePercentage >= pillar.passThreshold
      }

      const completionPercentage = unlockedSections.length > 0 ? Math.round((unlockedSections.filter((s) => s.completed).length / unlockedSections.length) * 100) : 0

      return {
        ...pillar,
        locked: isLocked,
        scheduledDate: dateByPillarId.get(pillar.id) ?? null,
        sections: sectionsWithForms,
        completed,
        scorePercentage,
        completionPercentage,
      }
    }),
  )

  // Group pillars into sequential "steps" — consecutive pillars sharing
  // parallelWithPrevious=true belong to the same step (this was previously a
  // purely visual grouping, see assigned-programs.tsx's groupPillarsByStep).
  // Only an actual parallel group (a step with 2+ pillars) acts as a gate —
  // solo pillars never block one another, so they're all open by default.
  // Once a parallel group's mandatory pillars are all complete, everything
  // after it opens at once (until the next parallel group, if any).
  const steps: (typeof pillarsWithCompletion)[] = []
  for (const pillar of pillarsWithCompletion) {
    if (pillar.parallelWithPrevious && steps.length > 0) {
      steps[steps.length - 1].push(pillar)
    } else {
      steps.push([pillar])
    }
  }

  let barrierClear = true
  const pillarsWithAccess = steps.flatMap((step) => {
    const accessible = barrierClear
    if (step.length > 1) {
      barrierClear = accessible && step.every((p) => p.locked || !p.mandatory || p.completed)
    }
    // Distinct from the admin's manual `locked` toggle — this pillar hasn't
    // been locked, it just isn't reachable yet because an earlier parallel
    // group isn't done.
    return step.map((pillar) => {
      const isPillarUnlocked = unlockedPillarIdsOverride.has(pillar.id)
      const isLocked = pillar.locked && !isPillarUnlocked
      const sequenceLocked = !isLocked && !accessible && !isPillarUnlocked
      return { ...pillar, locked: isLocked, sequenceLocked }
    })
  })

  const unlockedPillarsWithCompletion = pillarsWithAccess.filter((p) => !p.locked)

  return {
    ...program,
    pillars: pillarsWithAccess,
    // A skippable (non-mandatory) pillar doesn't block the program's overall
    // completion even if left unfinished — it still reports its own real
    // completed/scorePercentage above, it's just excluded from this gate.
    completed: unlockedPillarsWithCompletion.every((p) => !p.mandatory || p.completed),
  }
}

/**
 * Flattened pillar list (title + completed) across every program assigned to
 * a company's cohort — what the founder's Overview page needs for a compact
 * "Pillar Progress" summary, without the per-section/per-form detail that
 * getAssignedProgramDetailForCompany carries. Locked pillars are excluded,
 * same as the cohort-progress view for admins.
 */
export async function getPillarsSummaryForCompany(tenantId: number, cohortId: number, companyId: number) {
  const rows = await db
    .selectDistinct({ id: programs.id })
    .from(cohortTasks)
    .innerJoin(programs, eq(cohortTasks.programId, programs.id))
    .where(
      and(
        eq(cohortTasks.tenantId, tenantId),
        eq(cohortTasks.cohortId, cohortId),
        or(isNull(cohortTasks.companyId), eq(cohortTasks.companyId, companyId)),
        eq(programs.locked, false),
      ),
    )

  const details = await Promise.all(rows.map((row) => getAssignedProgramDetailForCompany(tenantId, cohortId, companyId, row.id)))

  return details
    .filter((detail): detail is NonNullable<typeof detail> => detail !== null)
    .flatMap((detail) => detail.pillars.filter((p) => !p.locked).map((p) => ({ pillarId: p.id, title: p.title, completed: p.completed })))
}

/**
 * Per-company completion status for every program assigned to a cohort —
 * what the tenant admin's cohort view needs to show progress per company.
 * Locked pillars are excluded from the counts (nothing for the founder to
 * act on yet).
 */
export async function getCompanyProgressForCohort(tenantId: number, cohortId: number) {
  const [cohort] = await db.select({ id: cohorts.id }).from(cohorts).where(and(eq(cohorts.id, cohortId), eq(cohorts.tenantId, tenantId))).limit(1)
  if (!cohort) throw new Error('Cohort not found')

  const cohortCompanies = await db.select().from(companies).where(and(eq(companies.tenantId, tenantId), eq(companies.cohortId, cohortId)))

  const result: Array<{ companyId: number; programId: number; programName: string; completedPillars: number; totalPillars: number; completed: boolean }> = []
  for (const company of cohortCompanies) {
    const assignedPrograms = await db
      .selectDistinct({ id: programs.id, name: programs.name })
      .from(cohortTasks)
      .innerJoin(programs, eq(cohortTasks.programId, programs.id))
      .where(
        and(
          eq(cohortTasks.tenantId, tenantId),
          eq(cohortTasks.cohortId, cohortId),
          or(isNull(cohortTasks.companyId), eq(cohortTasks.companyId, company.id)),
          eq(programs.locked, false),
        ),
      )

    for (const program of assignedPrograms) {
      const detail = await getAssignedProgramDetailForCompany(tenantId, cohortId, company.id, program.id)
      if (!detail) continue
      const unlockedPillars = detail.pillars.filter((p) => !p.locked)
      result.push({
        companyId: company.id,
        programId: program.id,
        programName: program.name,
        completedPillars: unlockedPillars.filter((p) => p.completed).length,
        totalPillars: unlockedPillars.length,
        completed: detail.completed,
      })
    }
  }
  return result
}

/**
 * A company's submitted answers in plain question/answer form — for the
 * tenant admin (every pillar) or a mentor (only the pillars they're assigned
 * to on that cohort) to read without touching raw response JSON. Draft
 * (not-yet-submitted) responses are excluded, same as the completion logic above.
 */
export async function getCompanyFormAnswers(tenantId: number, cohortId: number, companyId: number, mentorUserId?: number) {
  let allowedPillarIds: Set<number> | null = null
  if (mentorUserId !== undefined) {
    const assignments = await listMentorAssignments(tenantId, mentorUserId)
    allowedPillarIds = new Set(
      assignments
        .filter((a) => a.cohortId === cohortId && a.pillarId !== null)
        .map((a) => a.pillarId as number)
    )
    if (allowedPillarIds.size === 0) return []
  }

  const assignedPrograms = await listAssignedProgramsForCompany(tenantId, cohortId, companyId)
  const details = await Promise.all(assignedPrograms.map((p) => getAssignedProgramDetailForCompany(tenantId, cohortId, companyId, p.id)))

  const result: Array<{
    programName: string
    pillarTitle: string
    sectionTitle: string
    sectionId: number
    formId: number
    formName: string
    submittedAt: Date | null
    answers: { questionTitle: string; value: unknown }[]
    // Metadata only — fetch the file itself on demand (getSectionFormResponseDocument)
    // so a company with several attached documents doesn't balloon this list's payload.
    document: { fileName: string; fileType: string; fileSize: number } | null
  }> = []

  for (const detail of details) {
    if (!detail) continue
    for (const pillar of detail.pillars) {
      if (pillar.locked) continue
      if (allowedPillarIds && !allowedPillarIds.has(pillar.id)) continue
      for (const section of pillar.sections) {
        if (section.locked) continue
        for (const form of section.forms) {
          if (!form.submitted) continue
          const response = await getSectionFormResponse(tenantId, companyId, section.id, form.id)
          if (!response) continue
          const [template] = await db.select({ schema: formTemplates.schema }).from(formTemplates).where(eq(formTemplates.id, form.id)).limit(1)
          const schema = (template?.schema as FormQuestion[]) ?? []
          const titleByQuestionId = new Map(schema.map((q) => [q.id, q.title]))
          const answers = Object.entries((response.responseJson as Record<string, unknown>) ?? {}).map(([questionId, value]) => ({
            questionTitle: titleByQuestionId.get(questionId) ?? questionId,
            value,
          }))
          result.push({
            programName: detail.name,
            pillarTitle: pillar.title,
            sectionTitle: section.title,
            sectionId: section.id,
            formId: form.id,
            formName: form.name,
            submittedAt: response.submittedAt,
            answers,
            document: response.documentFileName
              ? { fileName: response.documentFileName, fileType: response.documentFileType!, fileSize: response.documentFileSize! }
              : null,
          })
        }
      }
    }
  }
  return result
}