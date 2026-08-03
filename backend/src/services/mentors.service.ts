import { eq, and, or } from 'drizzle-orm'
import { db } from '../db/client'
import { users, mentorProfiles, formTemplates, type FormQuestion } from '../models'
import { resolveOnboardingMapping } from './form-mappings.service'
import { extractSpecializationFromResponse } from '../utils/onboarding-extract'

/** Dedicated mentor-role accounts, PLUS admin-role accounts that have opted in via the "interested in mentoring" toggle — the full pool a pillar can be assigned to. */
export async function listEligibleMentors(tenantId: number) {
  return db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, specialization: mentorProfiles.specialization })
    .from(users)
    .leftJoin(mentorProfiles, eq(mentorProfiles.userId, users.id))
    .where(and(eq(users.tenantId, tenantId), or(eq(users.role, 'mentor'), and(eq(users.role, 'admin'), eq(users.interestedInMentoring, true)))))
}

export async function getMentorProfile(tenantId: number, userId: number) {
  const [profile] = await db.select().from(mentorProfiles).where(and(eq(mentorProfiles.tenantId, tenantId), eq(mentorProfiles.userId, userId))).limit(1)
  return profile ?? null
}

export async function setMentorSpecialization(tenantId: number, userId: number, specialization: string) {
  const existing = await getMentorProfile(tenantId, userId)
  if (existing) {
    const [updated] = await db
      .update(mentorProfiles)
      .set({ specialization, updatedAt: new Date() })
      .where(eq(mentorProfiles.id, existing.id))
      .returning()
    return updated
  }
  const [created] = await db.insert(mentorProfiles).values({ tenantId, userId, specialization }).returning()
  return created
}

/** Whether a tenant-mapped 'mentor_onboarding' Assessment Form should replace the hardcoded specialization step — mentors aren't cohort-scoped, so this is always tenant-wide. */
export async function getMentorOnboardingForm(tenantId: number) {
  const resolved = await resolveOnboardingMapping(tenantId, 'mentor_onboarding', null)
  if (!resolved) return null
  return {
    mappingId: resolved.id,
    templateId: resolved.template.id,
    title: resolved.template.title,
    schema: resolved.template.schema,
    category: resolved.template.category,
    requireConsent: resolved.template.requireConsent,
    consentTermsText: resolved.template.consentTermsText,
  }
}

/** Specialization is best-effort extracted from the response; the full response is always kept alongside it, even when extraction misses. */
export async function setMentorOnboardingResponse(tenantId: number, userId: number, templateId: number, responseJson: Record<string, unknown>) {
  const [template] = await db.select().from(formTemplates).where(eq(formTemplates.id, templateId)).limit(1)
  if (!template) throw new Error('Onboarding form not found')

  const specialization = extractSpecializationFromResponse((template.schema as FormQuestion[]) ?? [], responseJson)

  const existing = await getMentorProfile(tenantId, userId)
  if (existing) {
    const [updated] = await db
      .update(mentorProfiles)
      .set({ specialization, onboardingResponseJson: responseJson, updatedAt: new Date() })
      .where(eq(mentorProfiles.id, existing.id))
      .returning()
    return updated
  }
  const [created] = await db.insert(mentorProfiles).values({ tenantId, userId, specialization, onboardingResponseJson: responseJson }).returning()
  return created
}

export async function getInterestedInMentoring(userId: number) {
  const [user] = await db.select({ interestedInMentoring: users.interestedInMentoring }).from(users).where(eq(users.id, userId)).limit(1)
  if (!user) throw new Error('User not found')
  return user
}

export async function setInterestedInMentoring(userId: number, interested: boolean) {
  const [updated] = await db
    .update(users)
    .set({ interestedInMentoring: interested, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({ interestedInMentoring: users.interestedInMentoring })
  if (!updated) throw new Error('User not found')
  return updated
}
