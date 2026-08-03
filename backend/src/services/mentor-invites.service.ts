import crypto from 'crypto'
import { eq, and, or, desc } from 'drizzle-orm'
import { db } from '../db/client'
import { tenantInvites, tenants, users, mentorProfiles } from '../models'
import { sendMentorInviteEmail } from './ses.service'
import { cognitoAdminCreateUser, cognitoAdminSetPassword, cognitoAdminGetSub, cognitoSignIn } from './auth.service'
import { tenantUrl } from '../utils/host'

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/** Sent by a tenant admin OR an existing mentor — mentors can invite their peers, per the mentor sidebar's "Invite Mentors" item. */
export async function createMentorInvite(params: { tenantId: number; name: string; email: string }) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, params.tenantId)).limit(1)
  if (!tenant) throw new Error('Tenant not found')

  const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, params.email)).limit(1)
  if (existingUser) throw new Error('An account with this email already exists.')

  const token = generateInviteToken()
  const [invite] = await db
    .insert(tenantInvites)
    .values({
      tenantId: params.tenantId,
      email: params.email,
      name: params.name,
      role: 'mentor',
      token,
      status: 'pending',
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    })
    .returning()

  const baseDomain = process.env.BASE_DOMAIN || 'localhost'
  const inviteUrl = `${tenantUrl(tenant.slug, baseDomain)}/accept-mentor-invite?token=${token}`
  await sendMentorInviteEmail({ to: params.email, name: params.name, tenantName: tenant.name, inviteUrl })

  return invite
}

/** Mentors + still-pending mentor invites, for the admin/mentor-facing "Mentors" page. */
export async function listMentorEntries(tenantId: number) {
  const [mentorRows, inviteRows] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        disabled: users.disabled,
        createdAt: users.createdAt,
        specialization: mentorProfiles.specialization,
        allowedMenus: users.allowedMenus,
        canSetPermissions: users.canSetPermissions,
      })
      .from(users)
      .leftJoin(mentorProfiles, eq(mentorProfiles.userId, users.id))
      .where(and(eq(users.tenantId, tenantId), or(eq(users.role, 'mentor'), and(eq(users.role, 'admin'), eq(users.interestedInMentoring, true)))))
      .orderBy(desc(users.createdAt)),
    db
      .select({ id: tenantInvites.id, email: tenantInvites.email, name: tenantInvites.name, status: tenantInvites.status, expiresAt: tenantInvites.expiresAt, createdAt: tenantInvites.createdAt })
      .from(tenantInvites)
      .where(and(eq(tenantInvites.tenantId, tenantId), eq(tenantInvites.role, 'mentor'), eq(tenantInvites.status, 'pending')))
      .orderBy(desc(tenantInvites.createdAt)),
  ])

  const now = new Date()
  type MentorEntry = {
    id: string
    status: 'active' | 'invited' | 'expired' | 'inactive'
    name: string | null
    email: string
    specialization: string | null
    createdAt: Date
    allowedMenus: unknown | null
    canSetPermissions: boolean
  }
  const entries: MentorEntry[] = [
    ...mentorRows.map((m): MentorEntry => ({
      id: `mentor-${m.id}`,
      status: m.disabled ? 'inactive' : 'active',
      name: m.name,
      email: m.email,
      specialization: m.specialization,
      createdAt: m.createdAt,
      allowedMenus: m.allowedMenus,
      canSetPermissions: m.canSetPermissions,
    })),
    ...inviteRows.map((i): MentorEntry => ({
      id: `invite-${i.id}`,
      status: i.expiresAt < now ? 'expired' : 'invited',
      name: i.name,
      email: i.email,
      specialization: null,
      createdAt: i.createdAt,
      allowedMenus: null,
      canSetPermissions: false,
    })),
  ]
  return entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

async function getPendingMentorInviteByToken(token: string) {
  const [invite] = await db.select().from(tenantInvites).where(and(eq(tenantInvites.token, token), eq(tenantInvites.role, 'mentor'))).limit(1)
  if (!invite || invite.status !== 'pending') return null
  if (invite.expiresAt < new Date()) return null
  return invite
}

export async function getMentorInviteDetails(token: string) {
  const invite = await getPendingMentorInviteByToken(token)
  if (!invite) return null
  const [tenant] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, invite.tenantId)).limit(1)
  return { email: invite.email, name: invite.name, tenantName: tenant?.name ?? '' }
}

/** Mirrors acceptCompanyInvite — creates the Cognito user + sets their chosen password + signs them in, landing them authenticated on the "area of specialization" step. */
export async function acceptMentorInvite(token: string, password: string) {
  const invite = await getPendingMentorInviteByToken(token)
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
      role: 'mentor',
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
