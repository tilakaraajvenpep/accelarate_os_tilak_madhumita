import crypto from 'crypto'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/client'
import { tenantInvites, companies, tenants, users } from '../models'
import { sendCompanyInviteEmail } from './ses.service'
import { cognitoAdminCreateUser, cognitoAdminSetPassword, cognitoAdminGetSub, cognitoSignIn, cognitoAdminUpdateName } from './auth.service'
import { tenantUrl } from '../utils/host'

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export async function createCompanyInvite(params: { tenantId: number; name: string; email: string }) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, params.tenantId)).limit(1)
  if (!tenant) throw new Error('Tenant not found')

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
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    })
    .returning()

  const baseDomain = process.env.BASE_DOMAIN || 'localhost'
  const inviteUrl = `${tenantUrl(tenant.slug, baseDomain)}/accept-invite?token=${token}`
  await sendCompanyInviteEmail({ to: params.email, name: params.name, tenantName: tenant.name, inviteUrl })

  return invite
}

/** Companies + still-pending invites, combined for the tenant admin's Companies list. */
export async function listCompanyEntries(tenantId: number) {
  const [companyRows, inviteRows] = await Promise.all([
    db
      .select({
        id: companies.id,
        name: companies.name,
        founderName: companies.founderName,
        location: companies.location,
        establishedYear: companies.establishedYear,
        email: users.email,
        createdAt: companies.createdAt,
      })
      .from(companies)
      .innerJoin(users, eq(companies.founderUserId, users.id))
      .where(eq(companies.tenantId, tenantId))
      .orderBy(desc(companies.createdAt)),
    db
      .select()
      .from(tenantInvites)
      .where(and(eq(tenantInvites.tenantId, tenantId), eq(tenantInvites.role, 'founder'), eq(tenantInvites.status, 'pending')))
      .orderBy(desc(tenantInvites.createdAt)),
  ])

  const now = new Date()
  type CompanyEntry = {
    id: string
    status: 'active' | 'invited' | 'expired'
    name: string | null
    founderName: string | null
    location: string | null
    establishedYear: number | null
    email: string
    createdAt: Date
  }
  const entries: CompanyEntry[] = [
    ...companyRows.map((c): CompanyEntry => ({
      id: `company-${c.id}`,
      status: 'active',
      name: c.name,
      founderName: c.founderName,
      location: c.location,
      establishedYear: c.establishedYear,
      email: c.email,
      createdAt: c.createdAt,
    })),
    ...inviteRows.map((i): CompanyEntry => ({
      id: `invite-${i.id}`,
      status: i.expiresAt < now ? 'expired' : 'invited',
      name: null,
      founderName: i.name,
      location: null,
      establishedYear: null,
      email: i.email,
      createdAt: i.createdAt,
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
 * Invitee sets their own password for the first time — creates the Cognito
 * user + set-password + DB user row together, then signs them straight in so
 * the frontend can carry on into the company-details step already
 * authenticated, with no separate login step.
 */
export async function acceptCompanyInvite(token: string, password: string) {
  const invite = await getPendingInviteByToken(token)
  if (!invite) throw new Error('This invite link is invalid or has expired')

  const [existingUser] = await db.select().from(users).where(eq(users.email, invite.email)).limit(1)
  if (existingUser) {
    throw new Error('An account with this email already exists. Please sign in instead, or contact support if you need help.')
  }

  try {
    await cognitoAdminCreateUser(invite.email, invite.name ?? invite.email)
  } catch (err: unknown) {
    if (!(err instanceof Error && err.name === 'UsernameExistsException')) throw err
  }
  await cognitoAdminSetPassword(invite.email, password)
  const cognitoSub = await cognitoAdminGetSub(invite.email)

  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      cognitoSub,
      email: invite.email,
      name: invite.name,
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
    },
  }
}

/** Idempotent — a founder only ever completes their own company-details form once. */
export async function createCompanyForFounder(params: {
  tenantId: number
  founderUserId: number
  founderEmail: string
  name: string
  location?: string | null
  establishedYear?: number | null
  founderName: string
}) {
  const [existing] = await db.select().from(companies).where(eq(companies.founderUserId, params.founderUserId)).limit(1)
  if (existing) return existing

  const created = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(companies)
      .values({
        tenantId: params.tenantId,
        founderUserId: params.founderUserId,
        name: params.name,
        location: params.location ?? null,
        establishedYear: params.establishedYear ?? null,
        founderName: params.founderName,
      })
      .returning()

    // The invite's name (set by whoever sent it) was only a placeholder — the
    // founder's own account name should reflect what they entered here.
    await tx.update(users).set({ name: params.founderName, updatedAt: new Date() }).where(eq(users.id, params.founderUserId))

    return created
  })

  // Keep Cognito's name attribute in sync too, so a future login doesn't
  // re-sync users.name back to the stale invite-time value (see upsertUser).
  await cognitoAdminUpdateName(params.founderEmail, params.founderName)

  return created
}
