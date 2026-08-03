import crypto from 'crypto'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/client'
import { tenantInvites, companies, tenants, users, companyMembers, cohorts } from '../models'
import { sendCompanyInviteEmail } from './ses.service'
import { cognitoAdminCreateUser, cognitoAdminSetPassword, cognitoAdminGetSub, cognitoSignIn } from './auth.service'
import { tenantUrl } from '../utils/host'

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export async function createCompanyInvite(params: { tenantId: number; name: string; email: string; cohortId: number }) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, params.tenantId)).limit(1)
  if (!tenant) throw new Error('Tenant not found')

  const [cohort] = await db.select().from(cohorts).where(and(eq(cohorts.id, params.cohortId), eq(cohorts.tenantId, params.tenantId))).limit(1)
  if (!cohort) throw new Error('Cohort not found')

  const token = generateInviteToken()
  const [invite] = await db
    .insert(tenantInvites)
    .values({
      tenantId: params.tenantId,
      email: params.email,
      name: params.name,
      role: 'founder',
      token,
      status: 'pending',
      cohortId: params.cohortId,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    })
    .returning()

  const baseDomain = process.env.BASE_DOMAIN || 'localhost'
  const inviteUrl = `${tenantUrl(tenant.slug, baseDomain)}/accept-invite?token=${token}`
  await sendCompanyInviteEmail({ to: params.email, name: params.name, tenantName: tenant.name, inviteUrl })

  return invite
}

/** Companies + still-pending invites, combined for the tenant admin's Companies list — optionally scoped to one cohort. */
export async function listCompanyEntries(tenantId: number, cohortId?: number) {
  const [companyRows, inviteRows] = await Promise.all([
    db
      .select({
        id: companies.id,
        name: companies.name,
        founderUserId: companies.founderUserId,
        founderName: companies.founderName,
        location: companies.location,
        establishedYear: companies.establishedYear,
        email: users.email,
        cohortId: companies.cohortId,
        cohortName: cohorts.name,
        createdAt: companies.createdAt,
        allowedMenus: users.allowedMenus,
        canSetPermissions: users.canSetPermissions,
      })
      .from(companies)
      .innerJoin(users, eq(companies.founderUserId, users.id))
      .leftJoin(cohorts, eq(companies.cohortId, cohorts.id))
      .where(cohortId === undefined ? eq(companies.tenantId, tenantId) : and(eq(companies.tenantId, tenantId), eq(companies.cohortId, cohortId)))
      .orderBy(desc(companies.createdAt)),
    db
      .select({
        id: tenantInvites.id,
        email: tenantInvites.email,
        name: tenantInvites.name,
        status: tenantInvites.status,
        expiresAt: tenantInvites.expiresAt,
        cohortId: tenantInvites.cohortId,
        cohortName: cohorts.name,
        createdAt: tenantInvites.createdAt,
      })
      .from(tenantInvites)
      .leftJoin(cohorts, eq(tenantInvites.cohortId, cohorts.id))
      .where(
        cohortId === undefined
          ? and(eq(tenantInvites.tenantId, tenantId), eq(tenantInvites.role, 'founder'), eq(tenantInvites.status, 'pending'))
          : and(
              eq(tenantInvites.tenantId, tenantId),
              eq(tenantInvites.role, 'founder'),
              eq(tenantInvites.status, 'pending'),
              eq(tenantInvites.cohortId, cohortId),
            ),
      )
      .orderBy(desc(tenantInvites.createdAt)),
  ])

  const now = new Date()
  type CompanyEntry = {
    id: string
    status: 'active' | 'invited' | 'expired'
    name: string | null
    founderUserId: number | null
    founderName: string | null
    location: string | null
    establishedYear: number | null
    email: string
    cohortId: number | null
    cohortName: string | null
    createdAt: Date
    allowedMenus: unknown | null
    canSetPermissions: boolean
  }
  const entries: CompanyEntry[] = [
    ...companyRows.map((c): CompanyEntry => ({
      id: `company-${c.id}`,
      status: 'active',
      name: c.name,
      founderUserId: c.founderUserId,
      founderName: c.founderName,
      location: c.location,
      establishedYear: c.establishedYear,
      email: c.email,
      cohortId: c.cohortId,
      cohortName: c.cohortName,
      createdAt: c.createdAt,
      allowedMenus: c.allowedMenus,
      canSetPermissions: c.canSetPermissions,
    })),
    ...inviteRows.map((i): CompanyEntry => ({
      id: `invite-${i.id}`,
      status: i.expiresAt < now ? 'expired' : 'invited',
      name: null,
      founderUserId: null,
      founderName: i.name,
      location: null,
      establishedYear: null,
      email: i.email,
      cohortId: i.cohortId,
      cohortName: i.cohortName,
      createdAt: i.createdAt,
      allowedMenus: null,
      canSetPermissions: false,
    })),
  ]
  return entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

async function getPendingInviteByToken(token: string) {
  const [invite] = await db.select().from(tenantInvites).where(eq(tenantInvites.token, token)).limit(1)
  if (!invite || invite.status !== 'pending') return null
  if (invite.expiresAt < new Date()) return null
  return invite
}

export async function getInviteDetails(token: string) {
  const invite = await getPendingInviteByToken(token)
  if (!invite) return null
  const [tenant] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, invite.tenantId)).limit(1)
  return { email: invite.email, name: invite.name, tenantName: tenant?.name ?? '' }
}

/**
 * Invitee sets their own password and full name for the first time — creates
 * the Cognito user + set-password + DB user row together, then signs them
 * straight in so the frontend can carry on into the company-onboarding step
 * already authenticated, with no separate login step. `fullName` (the
 * founder's own input, not the invite's admin-typed placeholder) becomes the
 * account's name from this point forward — used everywhere in the app.
 */
export async function acceptCompanyInvite(token: string, password: string, fullName: string) {
  const invite = await getPendingInviteByToken(token)
  if (!invite) throw new Error('This invite link is invalid or has expired')

  const [existingUser] = await db.select().from(users).where(eq(users.email, invite.email)).limit(1)
  if (existingUser) {
    throw new Error('An account with this email already exists. Please sign in instead, or contact support if you need help.')
  }

  try {
    await cognitoAdminCreateUser(invite.email, fullName)
  } catch (err: unknown) {
    if (!(err instanceof Error && err.name === 'UsernameExistsException')) throw err
  }
  await cognitoAdminSetPassword(invite.email, password)
  const cognitoSub = await cognitoAdminGetSub(invite.email)

  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      cognitoSub,
      email: invite.email,
      name: fullName,
      role: 'founder',
      tenantId: invite.tenantId,
      emailVerified: true,
    })
    await tx.update(tenantInvites).set({ status: 'accepted', updatedAt: new Date() }).where(eq(tenantInvites.id, invite.id))
  })

  const result = await cognitoSignIn(invite.email, password)
  const t = result.AuthenticationResult
  if (!t?.IdToken || !t?.AccessToken) throw new Error('Missing tokens from Cognito')

  const [dbUser] = await db.select().from(users).where(eq(users.cognitoSub, cognitoSub)).limit(1)
  if (!dbUser) throw new Error('Failed to create user account')
  const tenantSlug = (await db.select({ slug: tenants.slug }).from(tenants).where(eq(tenants.id, invite.tenantId)).limit(1))[0]?.slug ?? null

  return {
    accessToken: t.AccessToken,
    idToken: t.IdToken,
    refreshToken: t.RefreshToken!,
    expiresIn: t.ExpiresIn!,
    user: {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      tenantId: dbUser.tenantId,
      tenantSlug,
      allowedMenus: dbUser.allowedMenus,
      canSetPermissions: dbUser.canSetPermissions,
    },
  }
}

async function getAcceptedFounderInviteCohortId(tenantId: number, founderEmail: string) {
  const [acceptedInvite] = await db
    .select({ cohortId: tenantInvites.cohortId })
    .from(tenantInvites)
    .where(
      and(
        eq(tenantInvites.tenantId, tenantId),
        eq(tenantInvites.email, founderEmail),
        eq(tenantInvites.role, 'founder'),
        eq(tenantInvites.status, 'accepted'),
      ),
    )
    .orderBy(desc(tenantInvites.createdAt))
    .limit(1)
  return acceptedInvite?.cohortId ?? null
}

/**
 * Idempotent — the founder's company row is created once, empty (status
 * 'draft'), the moment they're authenticated, so there's always something to
 * save partial onboarding answers against. founderName is set here (from the
 * account name collected at the password step) and never changes again.
 */
export async function getOrCreateDraftCompany(tenantId: number, founderUserId: number, founderEmail: string, founderName: string) {
  const [existing] = await db.select().from(companies).where(eq(companies.founderUserId, founderUserId)).limit(1)
  if (existing) return existing

  // The company inherits the cohort from the invite the founder accepted — they never choose it themselves.
  const cohortId = await getAcceptedFounderInviteCohortId(tenantId, founderEmail)

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(companies)
      .values({ tenantId, founderUserId, cohortId, founderName, status: 'draft' })
      .returning()
    await tx.insert(companyMembers).values({ tenantId, companyId: created.id, userId: founderUserId })
    return created
  })
}

export interface CompanyDraftFields {
  name?: string | null
  uen?: string | null
  industry?: string | null
  companySize?: string | null
  roleInBusiness?: string | null
  mobileNumber?: string | null
  consentWhatsapp?: boolean
  consentEmail?: boolean
}

/** Partial save — no field is required here, only at lockCompanyProfile. Throws if already locked. */
export async function saveCompanyDraft(tenantId: number, founderUserId: number, data: CompanyDraftFields) {
  const [existing] = await db.select().from(companies).where(and(eq(companies.tenantId, tenantId), eq(companies.founderUserId, founderUserId))).limit(1)
  if (!existing) throw new Error('Company profile not found')
  if (existing.status === 'locked') throw new Error('This company profile has already been submitted and locked.')

  const [updated] = await db
    .update(companies)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(companies.id, existing.id))
    .returning()
  return updated
}

export interface CompanyLockFields {
  name: string
  uen?: string | null
  industry: string
  companySize: string
  roleInBusiness: string
  mobileNumber: string
  consentWhatsapp: boolean
  consentEmail: boolean
  platformScopeAck: boolean
  participationAuthorityAck: boolean
}

/** Final submit — validates every required field server-side (defense in depth alongside client validation), then permanently locks the profile. Throws if already locked. */
export async function lockCompanyProfile(tenantId: number, founderUserId: number, data: CompanyLockFields) {
  const [existing] = await db.select().from(companies).where(and(eq(companies.tenantId, tenantId), eq(companies.founderUserId, founderUserId))).limit(1)
  if (!existing) throw new Error('Company profile not found')
  if (existing.status === 'locked') throw new Error('This company profile has already been submitted and locked.')

  if (!data.name.trim()) throw new Error('Business / Brand Name is required')
  if (!data.industry) throw new Error('Industry is required')
  if (!data.companySize) throw new Error('Company size is required')
  if (!data.roleInBusiness) throw new Error('Role in Business is required')
  if (!data.mobileNumber.trim()) throw new Error('Mobile number is required')
  if (!data.platformScopeAck) throw new Error('Platform Scope Acknowledgement is required')
  if (!data.participationAuthorityAck) throw new Error('Participation Authority Declaration is required')

  const [updated] = await db
    .update(companies)
    .set({ ...data, status: 'locked', updatedAt: new Date() })
    .where(eq(companies.id, existing.id))
    .returning()
  return updated
}
