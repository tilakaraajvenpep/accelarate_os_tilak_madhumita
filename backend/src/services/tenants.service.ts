import { eq, and, inArray, desc, count } from 'drizzle-orm'
import { db } from '../db/client'
import {
  tenants,
  subscriptions,
  plans,
  users,
  tenantInvites,
  payments,
  emailOtps,
  companies,
  cohorts,
  cohortTasks,
  formTemplates,
  pillarDefinitions,
  pillars,
  sections,
  pillarSections,
  sectionForms,
  sectionFormResponses,
  sectionCompletions,
  programs,
  forms,
  cohortForms,
  cohortFormResponses,
  notifications,
  mentorProfiles,
  cohortPillarMentors,
} from '../models'
import { generateUniqueSlug } from '../utils/slug'
import { sendVerificationEmail } from './ses.service'
import {
  cognitoAdminCreateUser,
  cognitoAdminSetPassword,
  cognitoAdminGetSub,
  cognitoAdminDeleteUser,
} from './auth.service'

const OTP_TTL_MS = 10 * 60 * 1000

function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/** Sends a one-time code to an email address before its tenant/account exists
 * yet — verified inline in the Create Tenant dialog, so nothing is persisted
 * (no tenant, no Cognito user) until the code is confirmed. */
export async function sendTenantAdminOtp(email: string, orgName: string) {
  const code = generateOtpCode()
  await db.insert(emailOtps).values({ email, code, expiresAt: new Date(Date.now() + OTP_TTL_MS) })
  await sendVerificationEmail({ to: email, tenantName: orgName, code })
}

async function consumeTenantAdminOtp(email: string, code: string) {
  const [row] = await db
    .select()
    .from(emailOtps)
    .where(and(eq(emailOtps.email, email), eq(emailOtps.code, code)))
    .orderBy(desc(emailOtps.id))
    .limit(1)

  if (!row) throw new Error('Invalid verification code')
  if (row.consumed || row.expiresAt < new Date()) {
    throw new Error('This verification code has expired or was already used')
  }

  await db.update(emailOtps).set({ consumed: true, updatedAt: new Date() }).where(eq(emailOtps.id, row.id))
}

export async function listTenantsWithSubscription() {
  const [allTenants, allSubs, allPlans, founderCounts] = await Promise.all([
    db.select().from(tenants).orderBy(desc(tenants.createdAt)),
    db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt)),
    db.select().from(plans),
    db
      .select({ tenantId: users.tenantId, count: count() })
      .from(users)
      .where(eq(users.role, 'founder'))
      .groupBy(users.tenantId),
  ])

  const planById = new Map(allPlans.map((p) => [p.id, p]))
  const latestSubByTenant = new Map<number, (typeof allSubs)[number]>()
  for (const sub of allSubs) {
    if (!latestSubByTenant.has(sub.tenantId)) latestSubByTenant.set(sub.tenantId, sub)
  }
  const founderCountByTenant = new Map(
    founderCounts.filter((f) => f.tenantId !== null).map((f) => [f.tenantId as number, Number(f.count)]),
  )

  return allTenants.map((tenant) => {
    const sub = latestSubByTenant.get(tenant.id)
    const plan = sub ? planById.get(sub.planId) : undefined
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      orgType: tenant.orgType,
      website: tenant.website,
      logoUrl: tenant.logoUrl,
      suspended: tenant.suspended,
      emailServiceEnabled: tenant.emailServiceEnabled,
      createdAt: tenant.createdAt,
      plan: plan
        ? { id: plan.id, name: plan.name, foundersLimit: plan.foundersLimit, priceMonthlyCents: plan.priceMonthlyCents }
        : null,
      subscription: sub
        ? {
            id: sub.id,
            status: sub.status,
            billingType: sub.billingType,
            currentPeriodEnd: sub.currentPeriodEnd,
          }
        : null,
      foundersUsed: founderCountByTenant.get(tenant.id) ?? 0,
    }
  })
}

export async function getTenantAdminEmail(tenantId: number): Promise<string | null> {
  const [admin] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.tenantId, tenantId))
    .limit(1)
  return admin?.email ?? null
}

/**
 * Creates a tenant + its admin, with the password chosen by the super admin
 * up front. The admin's email must already be verified via a code sent by
 * `sendTenantAdminOtp` and confirmed in the same Create Tenant dialog — that
 * code is consumed here before anything is created, so no tenant or Cognito
 * account ever exists for an unverified email.
 */
export async function createTenantWithAdmin(data: {
  name: string
  orgType?: string | null
  website?: string | null
  slug?: string
  adminEmail: string
  adminName: string
  adminPassword: string
  otpCode: string
}) {
  await consumeTenantAdminOtp(data.adminEmail, data.otpCode)

  const slug = await generateUniqueSlug(data.slug || data.name)

  try {
    await cognitoAdminCreateUser(data.adminEmail, data.adminName)
  } catch (err: unknown) {
    if (!(err instanceof Error && err.name === 'UsernameExistsException')) throw err
  }
  await cognitoAdminSetPassword(data.adminEmail, data.adminPassword)
  const cognitoSub = await cognitoAdminGetSub(data.adminEmail)

  return db.transaction(async (tx) => {
    const [tenant] = await tx
      .insert(tenants)
      .values({
        name: data.name,
        slug,
        orgType: (data.orgType as (typeof tenants.$inferInsert)['orgType']) ?? null,
        website: data.website ?? null,
      })
      .returning()

    await tx.insert(users).values({
      cognitoSub,
      email: data.adminEmail,
      name: data.adminName,
      role: 'admin',
      tenantId: tenant.id,
      emailVerified: true,
    })

    return tenant
  })
}

/**
 * Permanently removes a tenant and everything tied to it — its subscriptions,
 * payment history, invites, DB user rows, and their Cognito accounts. Cognito
 * deletion is best-effort (logged, not fatal) so a missing/already-removed
 * account doesn't block the rest of the cleanup.
 */
export async function deleteTenant(tenantId: number) {
  const [activeSub] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(and(eq(subscriptions.tenantId, tenantId), inArray(subscriptions.status, ['trialing', 'active', 'past_due'])))
    .limit(1)
  if (activeSub) {
    throw new Error('This tenant has a plan currently assigned — cancel its subscription before deleting the tenant.')
  }

  const tenantUsers = await db
    .select({ email: users.email, cognitoSub: users.cognitoSub })
    .from(users)
    .where(eq(users.tenantId, tenantId))

  await db.transaction(async (tx) => {
    const subIds = (
      await tx.select({ id: subscriptions.id }).from(subscriptions).where(eq(subscriptions.tenantId, tenantId))
    ).map((s) => s.id)
    if (subIds.length > 0) {
      await tx.delete(payments).where(inArray(payments.subscriptionId, subIds))
    }
    await tx.delete(subscriptions).where(eq(subscriptions.tenantId, tenantId))
    await tx.delete(tenantInvites).where(eq(tenantInvites.tenantId, tenantId))
    // notifications references cohortTasks — must go before it's deleted.
    await tx.delete(notifications).where(eq(notifications.tenantId, tenantId))
    // cohortPillarMentors references cohorts/pillars/users — must go before all three.
    await tx.delete(cohortPillarMentors).where(eq(cohortPillarMentors.tenantId, tenantId))
    await tx.delete(mentorProfiles).where(eq(mentorProfiles.tenantId, tenantId))
    await tx.delete(cohortTasks).where(eq(cohortTasks.tenantId, tenantId))
    await tx.delete(pillarDefinitions).where(eq(pillarDefinitions.tenantId, tenantId))

    const tenantPillarIds = (await tx.select({ id: pillars.id }).from(pillars).where(eq(pillars.tenantId, tenantId))).map((p) => p.id)
    if (tenantPillarIds.length > 0) {
      await tx.delete(pillarSections).where(inArray(pillarSections.pillarId, tenantPillarIds))
    }
    const tenantSectionIds = (await tx.select({ id: sections.id }).from(sections).where(eq(sections.tenantId, tenantId))).map((s) => s.id)
    if (tenantSectionIds.length > 0) {
      await tx.delete(pillarSections).where(inArray(pillarSections.sectionId, tenantSectionIds))
      // sectionForms/sectionFormResponses reference form_templates — must be
      // gone before formTemplates itself is deleted below.
      await tx.delete(sectionForms).where(inArray(sectionForms.sectionId, tenantSectionIds))
    }
    await tx.delete(sectionFormResponses).where(eq(sectionFormResponses.tenantId, tenantId))
    await tx.delete(sectionCompletions).where(eq(sectionCompletions.tenantId, tenantId))
    // cohortForms/cohortFormResponses reference form_templates, cohorts, and
    // companies — must be gone before any of those are deleted below.
    await tx.delete(cohortFormResponses).where(eq(cohortFormResponses.tenantId, tenantId))
    await tx.delete(cohortForms).where(eq(cohortForms.tenantId, tenantId))
    // formTemplates cascades to formMappings and formResponses; companies
    // cascades to formResponses, companyPillars, companyMembers and
    // companyMemberInvites — both via onDelete: 'cascade' FKs.
    await tx.delete(formTemplates).where(eq(formTemplates.tenantId, tenantId))
    await tx.delete(companies).where(eq(companies.tenantId, tenantId))
    await tx.delete(cohorts).where(eq(cohorts.tenantId, tenantId))

    await tx.delete(pillars).where(eq(pillars.tenantId, tenantId))
    await tx.delete(sections).where(eq(sections.tenantId, tenantId))
    await tx.delete(forms).where(eq(forms.tenantId, tenantId))
    await tx.delete(programs).where(eq(programs.tenantId, tenantId))

    await tx.delete(users).where(eq(users.tenantId, tenantId))
    const [deleted] = await tx.delete(tenants).where(eq(tenants.id, tenantId)).returning()
    if (!deleted) throw new Error('Tenant not found')
  })

  for (const u of tenantUsers) {
    if (!u.cognitoSub) continue
    try {
      await cognitoAdminDeleteUser(u.email)
    } catch (err) {
      console.error(`[tenants] failed to delete Cognito user ${u.email}:`, err)
    }
  }
}

export async function setTenantEmailServiceEnabled(tenantId: number, enabled: boolean) {
  const [updated] = await db
    .update(tenants)
    .set({ emailServiceEnabled: enabled, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId))
    .returning()
  if (!updated) throw new Error('Tenant not found')
  return updated
}

export async function getTenantNotificationSettings(tenantId: number) {
  const [tenant] = await db.select({ notificationsEnabled: tenants.notificationsEnabled }).from(tenants).where(eq(tenants.id, tenantId)).limit(1)
  if (!tenant) throw new Error('Tenant not found')
  return tenant
}

export async function setTenantNotificationsEnabled(tenantId: number, enabled: boolean) {
  const [updated] = await db
    .update(tenants)
    .set({ notificationsEnabled: enabled, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId))
    .returning({ notificationsEnabled: tenants.notificationsEnabled })
  if (!updated) throw new Error('Tenant not found')
  return updated
}

export async function getTenantDashboardInfo(tenantId: number) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)
  if (!tenant) return null

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1)

  let plan: { id: number; name: string; aiCredits: number } | null = null
  if (sub) {
    const [p] = await db.select().from(plans).where(eq(plans.id, sub.planId)).limit(1)
    if (p) plan = { id: p.id, name: p.name, aiCredits: p.aiCredits }
  }

  return {
    aiCreditsBalance: tenant.aiCreditsBalance,
    plan,
    subscriptionStatus: sub?.status ?? null,
  }
}

export async function getTenantBySlug(slug: string) {
  const [tenant] = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      logoUrl: tenants.logoUrl,
      brandColor: tenants.brandColor,
      backgroundColor: tenants.backgroundColor,
    })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1)
  return tenant ?? null
}

// data: URL only (e.g. "data:image/png;base64,...") — no S3/upload infra, so
// the logo is stored inline. Cap comfortably above what a reasonable logo
// needs (~1.5MB decoded) to keep the tenants row from growing unbounded.
const MAX_LOGO_DATA_URL_LENGTH = 2_000_000
const LOGO_DATA_URL_PATTERN = /^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/]+=*$/

export async function getTenantLogo(tenantId: number) {
  const [tenant] = await db.select({ logoUrl: tenants.logoUrl }).from(tenants).where(eq(tenants.id, tenantId)).limit(1)
  if (!tenant) throw new Error('Tenant not found')
  return tenant
}

export async function setTenantLogo(tenantId: number, logoUrl: string | null) {
  if (logoUrl !== null) {
    if (logoUrl.length > MAX_LOGO_DATA_URL_LENGTH) throw new Error('Logo image is too large')
    if (!LOGO_DATA_URL_PATTERN.test(logoUrl)) throw new Error('Logo must be a base64-encoded image')
  }
  const [updated] = await db
    .update(tenants)
    .set({ logoUrl, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId))
    .returning({ logoUrl: tenants.logoUrl })
  if (!updated) throw new Error('Tenant not found')
  return updated
}

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/

export async function getTenantBrandColor(tenantId: number) {
  const [tenant] = await db.select({ brandColor: tenants.brandColor }).from(tenants).where(eq(tenants.id, tenantId)).limit(1)
  if (!tenant) throw new Error('Tenant not found')
  return tenant
}

export async function setTenantBrandColor(tenantId: number, brandColor: string | null) {
  if (brandColor !== null && !HEX_COLOR_PATTERN.test(brandColor)) {
    throw new Error('Brand color must be a 6-digit hex value, e.g. #3b82f6')
  }
  const [updated] = await db
    .update(tenants)
    .set({ brandColor, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId))
    .returning({ brandColor: tenants.brandColor })
  if (!updated) throw new Error('Tenant not found')
  return updated
}

export async function getTenantBackgroundColor(tenantId: number) {
  const [tenant] = await db.select({ backgroundColor: tenants.backgroundColor }).from(tenants).where(eq(tenants.id, tenantId)).limit(1)
  if (!tenant) throw new Error('Tenant not found')
  return tenant
}

export async function setTenantBackgroundColor(tenantId: number, backgroundColor: string | null) {
  if (backgroundColor !== null && !HEX_COLOR_PATTERN.test(backgroundColor)) {
    throw new Error('Background color must be a 6-digit hex value, e.g. #0f172a')
  }
  const [updated] = await db
    .update(tenants)
    .set({ backgroundColor, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId))
    .returning({ backgroundColor: tenants.backgroundColor })
  if (!updated) throw new Error('Tenant not found')
  return updated
}

export async function getTenantSlugById(tenantId: number): Promise<string | null> {
  const [tenant] = await db.select({ slug: tenants.slug }).from(tenants).where(eq(tenants.id, tenantId)).limit(1)
  return tenant?.slug ?? null
}

