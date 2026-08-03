import { eq, and } from 'drizzle-orm'
import crypto from 'crypto'
import { db } from '../db/client'
import { users, superAdminInvites } from '../models'
import {
  cognitoAdminCreateUser,
  cognitoAdminSetPassword,
  cognitoAdminGetSub,
  cognitoAdminDeleteUser,
} from './auth.service'

const OTP_TTL_MS = 24 * 60 * 60 * 1000

function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex')
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  let out = ''
  for (let i = 0; i < 16; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export async function listSuperAdmins() {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      disabled: users.disabled,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.role, 'super_admin'))

  return rows
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(({ disabled, ...rest }) => ({ ...rest, active: !disabled }))
}

/**
 * Creates a super admin the same way tenant admins are created: the Cognito
 * account + DB row exist immediately with a permanent password, but
 * `emailVerified` stays false until the OTP emailed via SES is confirmed —
 * the login route already blocks sign-in for unverified users. The OTP is
 * only ever held at rest as a hash (`super_admin_invites.code_hash`); the
 * plaintext code is returned here just long enough to be emailed.
 */
export async function createSuperAdmin(data: { name?: string | null; email: string; password: string }) {
  try {
    await cognitoAdminCreateUser(data.email, data.name || data.email)
  } catch (err: unknown) {
    if (!(err instanceof Error && err.name === 'UsernameExistsException')) throw err
  }
  await cognitoAdminSetPassword(data.email, data.password)
  const cognitoSub = await cognitoAdminGetSub(data.email)

  const code = generateOtpCode()

  const user = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        cognitoSub,
        email: data.email,
        name: data.name || null,
        role: 'super_admin',
        emailVerified: false,
      })
      .returning()

    await tx
      .insert(superAdminInvites)
      .values({
        email: data.email,
        name: data.name || null,
        codeHash: hashCode(code),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      })
      .onConflictDoUpdate({
        target: superAdminInvites.email,
        set: {
          name: data.name || null,
          codeHash: hashCode(code),
          expiresAt: new Date(Date.now() + OTP_TTL_MS),
          createdAt: new Date(),
        },
      })

    return user
  })

  return { user, code }
}

export async function verifySuperAdminOtp(email: string, code: string) {
  const [invite] = await db.select().from(superAdminInvites).where(eq(superAdminInvites.email, email)).limit(1)

  if (!invite) throw new Error('Invalid verification code')
  if (invite.expiresAt < new Date()) {
    throw new Error('This verification code has expired or was already used')
  }

  const provided = Buffer.from(hashCode(code))
  const expected = Buffer.from(invite.codeHash)
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    throw new Error('Invalid verification code')
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(and(eq(users.email, email), eq(users.role, 'super_admin')))
    await tx.delete(superAdminInvites).where(eq(superAdminInvites.id, invite.id))
  })
}

/**
 * Updates a super admin's name and/or email. A name-only change is a plain DB
 * update. Because Cognito uses email as the username, changing the email
 * means re-provisioning the Cognito account under the new address (fresh
 * temporary password, old account deleted) — the new password is emailed to
 * the admin via SES so they can sign in and set their own.
 */
export async function updateSuperAdmin(id: number, data: { name?: string | null; email?: string }) {
  const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!existing) throw new Error('Super admin not found')

  const emailChanged = data.email && data.email !== existing.email
  if (!emailChanged) {
    const [updated] = await db
      .update(users)
      .set({ name: data.name ?? existing.name, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning()
    return { user: updated, tempPassword: null as string | null }
  }

  const newEmail = data.email!
  const [emailTaken] = await db.select({ id: users.id }).from(users).where(eq(users.email, newEmail)).limit(1)
  if (emailTaken) throw new Error('That email is already in use')

  const name = data.name ?? existing.name
  const tempPassword = generatePassword()

  await cognitoAdminCreateUser(newEmail, name || newEmail)
  await cognitoAdminSetPassword(newEmail, tempPassword)
  const cognitoSub = await cognitoAdminGetSub(newEmail)

  if (existing.cognitoSub) {
    try {
      await cognitoAdminDeleteUser(existing.email)
    } catch (err) {
      console.error(`[super-admins] failed to delete old Cognito user ${existing.email}:`, err)
    }
  }

  const [updated] = await db
    .update(users)
    .set({ name, email: newEmail, cognitoSub, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning()

  return { user: updated, tempPassword }
}

export async function setSuperAdminActive(id: number, active: boolean) {
  const [updated] = await db
    .update(users)
    .set({ disabled: !active, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning()
  if (!updated) throw new Error('Super admin not found')
  return updated
}

export async function deleteSuperAdmin(id: number) {
  const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!existing) throw new Error('Super admin not found')

  await db.delete(users).where(eq(users.id, id))

  if (existing.cognitoSub) {
    try {
      await cognitoAdminDeleteUser(existing.email)
    } catch (err) {
      console.error(`[super-admins] failed to delete Cognito user ${existing.email}:`, err)
    }
  }
}
