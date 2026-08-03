import { eq, and } from 'drizzle-orm'
import { db } from '../db/client'
import { companyMembers, companyMemberInvites, companies, users, tenants } from '../models'
import { sendCompanyMemberInviteEmail } from './ses.service'
import { cognitoAdminCreateUser, cognitoAdminSetPassword, cognitoAdminGetSub } from './auth.service'
import { tenantUrl } from '../utils/host'

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/** Canonical "which company does this user belong to" lookup — the source of
 * truth for founder/co-founder access, superseding ad-hoc founderUserId checks. */
export async function getCompanyForUser(tenantId: number, userId: number) {
  const [row] = await db
    .select({ company: companies })
    .from(companyMembers)
    .innerJoin(companies, eq(companyMembers.companyId, companies.id))
    .where(and(eq(companyMembers.tenantId, tenantId), eq(companyMembers.userId, userId)))
    .limit(1)
  return row?.company ?? null
}

export async function isCompanyMember(companyId: number, userId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: companyMembers.id })
    .from(companyMembers)
    .where(and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, userId)))
    .limit(1)
  return !!row
}

export async function listCompanyMembers(companyId: number) {
  return db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      joinedAt: companyMembers.createdAt,
      allowedMenus: users.allowedMenus,
      canSetPermissions: users.canSetPermissions,
    })
    .from(companyMembers)
    .innerJoin(users, eq(companyMembers.userId, users.id))
    .where(eq(companyMembers.companyId, companyId))
    .orderBy(companyMembers.createdAt)
}

export async function inviteCompanyMember(params: {
  tenantId: number
  companyId: number
  companyName: string
  email: string
  invitedByUserId: number
  inviterName: string
}) {
  const code = generateCode()
  await db.insert(companyMemberInvites).values({
    tenantId: params.tenantId,
    companyId: params.companyId,
    email: params.email,
    code,
    invitedByUserId: params.invitedByUserId,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  })

  const [tenant] = await db.select({ slug: tenants.slug }).from(tenants).where(eq(tenants.id, params.tenantId)).limit(1)
  const baseDomain = process.env.BASE_DOMAIN || 'localhost'
  const acceptUrl = `${tenantUrl(tenant?.slug ?? '', baseDomain)}/accept-company-invite?companyId=${params.companyId}&email=${encodeURIComponent(params.email)}`

  await sendCompanyMemberInviteEmail({
    to: params.email,
    inviterName: params.inviterName,
    companyName: params.companyName,
    code,
    acceptUrl,
  })
}

export async function acceptCompanyMemberInvite(params: {
  companyId: number
  email: string
  code: string
  name?: string
  password?: string
}) {
  const [invite] = await db
    .select()
    .from(companyMemberInvites)
    .where(
      and(
        eq(companyMemberInvites.companyId, params.companyId),
        eq(companyMemberInvites.email, params.email),
        eq(companyMemberInvites.code, params.code),
      ),
    )
    .limit(1)

  if (!invite) throw new Error('Invalid verification code')
  if (invite.consumed || invite.expiresAt < new Date()) {
    throw new Error('This invite code has expired or was already used')
  }

  const [company] = await db.select().from(companies).where(eq(companies.id, params.companyId)).limit(1)
  if (!company) throw new Error('Company not found')

  const [existingUser] = await db.select().from(users).where(eq(users.email, params.email)).limit(1)

  let userId: number
  if (existingUser) {
    userId = existingUser.id
  } else {
    if (!params.name || !params.password) {
      throw new Error('Name and password are required for a new account')
    }
    try {
      await cognitoAdminCreateUser(params.email, params.name)
    } catch (err: unknown) {
      if (!(err instanceof Error && err.name === 'UsernameExistsException')) throw err
    }
    await cognitoAdminSetPassword(params.email, params.password)
    const cognitoSub = await cognitoAdminGetSub(params.email)

    const [created] = await db
      .insert(users)
      .values({
        cognitoSub,
        email: params.email,
        name: params.name,
        role: 'founder',
        tenantId: company.tenantId,
        emailVerified: true,
      })
      .returning()
    userId = created.id
  }

  await db.transaction(async (tx) => {
    await tx.update(companyMemberInvites).set({ consumed: true }).where(eq(companyMemberInvites.id, invite.id))
    await tx
      .insert(companyMembers)
      .values({ tenantId: company.tenantId, companyId: params.companyId, userId })
      .onConflictDoNothing()
  })

  return { companyId: params.companyId, userId }
}

export async function removeCompanyMember(companyId: number, userId: number) {
  const members = await db.select({ id: companyMembers.id }).from(companyMembers).where(eq(companyMembers.companyId, companyId))
  if (members.length <= 1) throw new Error('Cannot remove the last remaining member of a company')
  await db.delete(companyMembers).where(and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, userId)))
}
