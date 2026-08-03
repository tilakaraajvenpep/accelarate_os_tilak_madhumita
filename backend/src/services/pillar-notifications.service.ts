import { eq, and, isNull } from 'drizzle-orm'
import { db } from '../db/client'
import { cohortPillarMentors, companies, pillars, users } from '../models'
import { sendPillarSubmissionNotice } from './ses.service'

export async function notifyMentorOfPillarSubmission(params: {
  tenantId: number
  companyId: number
  pillarId: number
  authorUserId: number
  type: 'takeaway' | 'discussion'
  content: string
}) {
  try {
    // 1. Resolve company and cohort
    const [company] = await db
      .select({ name: companies.name, cohortId: companies.cohortId })
      .from(companies)
      .where(eq(companies.id, params.companyId))
      .limit(1)
    if (!company || !company.cohortId) return

    // 2. Resolve pillar
    const [pillar] = await db
      .select({ title: pillars.title })
      .from(pillars)
      .where(eq(pillars.id, params.pillarId))
      .limit(1)
    if (!pillar) return

    // 3. Resolve author (founder)
    const [author] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, params.authorUserId))
      .limit(1)
    const founderName = author?.name ?? 'A Founder'

    // 4. Find assigned mentor for this cohort + pillar
    // Check specific pillar first, fall back to general cohort-wide mentor (pillarId is null)
    let mentorRow = await db
      .select({ mentorUserId: cohortPillarMentors.mentorUserId })
      .from(cohortPillarMentors)
      .where(
        and(
          eq(cohortPillarMentors.tenantId, params.tenantId),
          eq(cohortPillarMentors.cohortId, company.cohortId),
          eq(cohortPillarMentors.pillarId, params.pillarId)
        )
      )
      .limit(1)

    if (mentorRow.length === 0) {
      mentorRow = await db
        .select({ mentorUserId: cohortPillarMentors.mentorUserId })
        .from(cohortPillarMentors)
        .where(
          and(
            eq(cohortPillarMentors.tenantId, params.tenantId),
            eq(cohortPillarMentors.cohortId, company.cohortId),
            isNull(cohortPillarMentors.pillarId)
          )
        )
        .limit(1)
    }

    if (mentorRow.length === 0) return // No mentor assigned

    const mentorUserId = mentorRow[0].mentorUserId

    // 5. Get mentor user info (name, email)
    const [mentor] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, mentorUserId))
      .limit(1)
    if (!mentor || !mentor.email) return

    // 6. Send email
    await sendPillarSubmissionNotice({
      to: mentor.email,
      mentorName: mentor.name ?? 'Mentor',
      founderName,
      companyName: company.name ?? 'Company',
      pillarTitle: pillar.title,
      type: params.type,
      content: params.content,
    })
  } catch (error) {
    console.error('Failed to notify mentor of pillar submission:', error)
  }
}
