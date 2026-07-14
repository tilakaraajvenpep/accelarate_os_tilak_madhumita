import crypto from 'crypto'
import { eq, and, ne, count } from 'drizzle-orm'
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminDeleteUserCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { db } from '../db/client'
import { users, superAdminInvites } from '../models'
import { sendOtpEmail } from './email.service'

const REGION = process.env.COGNITO_REGION || process.env.AWS_REGION || 'ap-southeast-1'
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID

const cognito = new CognitoIdentityProviderClient({ region: REGION })

const OTP_TTL_MS = 10 * 60 * 1000

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex')
}

export async function listSuperAdmins() {
  return db.select().from(users).where(eq(users.role, 'super_admin')).orderBy(users.createdAt)
}

/** Step 1: validate the email is free, generate an OTP, email it via SES. */
export async function requestSuperAdminOtp(email: string, name: string | null) {
  const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (existingUser) {
    throw new Error('A user with this email already exists')
  }

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
  const expiresAt = new Date(Date.now() + OTP_TTL_MS)

  await db
    .insert(superAdminInvites)
    .values({ email, name, codeHash: hashCode(code), expiresAt })
    .onConflictDoUpdate({
      target: superAdminInvites.email,
      set: { name, codeHash: hashCode(code), expiresAt, createdAt: new Date() },
    })

  await sendOtpEmail(email, code)
}

/** Step 2: check the OTP, then create the Cognito user + DB row as super_admin. */
export async function verifySuperAdminOtp(email: string, code: string, password: string) {
  if (!USER_POOL_ID) {
    throw new Error('COGNITO_USER_POOL_ID is not set in the environment')
  }

  const [invite] = await db
    .select()
    .from(superAdminInvites)
    .where(eq(superAdminInvites.email, email))
    .limit(1)

  if (!invite) throw new Error('No pending verification for this email — request a code first')
  if (invite.expiresAt.getTime() < Date.now()) throw new Error('Verification code has expired')
  if (invite.codeHash !== hashCode(code)) throw new Error('Invalid verification code')

  try {
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        MessageAction: 'SUPPRESS',
        UserAttributes: [
          { Name: 'email', Value: email },
          // We already verified this address ourselves via the OTP above.
          { Name: 'email_verified', Value: 'true' },
          ...(invite.name ? [{ Name: 'name', Value: invite.name }] : []),
        ],
      }),
    )
  } catch (err: unknown) {
    if (!(err instanceof Error && err.name === 'UsernameExistsException')) throw err
  }

  await cognito.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      Password: password,
      Permanent: true,
    }),
  )

  const details = await cognito.send(
    new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: email }),
  )
  const sub = details.UserAttributes?.find((a) => a.Name === 'sub')?.Value
  if (!sub) throw new Error('Could not resolve Cognito sub for the user')

  const [created] = await db
    .insert(users)
    .values({ cognitoSub: sub, email, name: invite.name, role: 'super_admin' })
    .returning()

  await db.delete(superAdminInvites).where(eq(superAdminInvites.email, email))

  return created
}

async function getSuperAdminOrThrow(id: number) {
  const [admin] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), eq(users.role, 'super_admin')))
    .limit(1)
  if (!admin) throw new Error('Super admin not found')
  return admin
}

async function assertNotLastSuperAdmin(excludingId: number) {
  const [row] = await db
    .select({ value: count() })
    .from(users)
    .where(and(eq(users.role, 'super_admin'), ne(users.id, excludingId)))
  if ((row?.value ?? 0) < 1) {
    throw new Error('Cannot remove the last remaining super admin')
  }
}

/** Enable/disable a super admin's ability to sign in. Blocked for self and for the last remaining super admin. */
export async function setSuperAdminDisabled(actingUserId: number, targetId: number, disabled: boolean) {
  if (!USER_POOL_ID) throw new Error('COGNITO_USER_POOL_ID is not set in the environment')
  if (targetId === actingUserId) throw new Error('You cannot disable your own account')

  const admin = await getSuperAdminOrThrow(targetId)
  if (disabled) await assertNotLastSuperAdmin(targetId)

  await cognito.send(
    disabled
      ? new AdminDisableUserCommand({ UserPoolId: USER_POOL_ID, Username: admin.email })
      : new AdminEnableUserCommand({ UserPoolId: USER_POOL_ID, Username: admin.email }),
  )

  const [updated] = await db
    .update(users)
    .set({ disabled, updatedAt: new Date() })
    .where(eq(users.id, targetId))
    .returning()
  return updated
}

/** Updates a super admin's name and/or email, keeping Cognito and the DB in sync. */
export async function updateSuperAdmin(
  targetId: number,
  data: { name?: string | null; email?: string },
) {
  if (!USER_POOL_ID) throw new Error('COGNITO_USER_POOL_ID is not set in the environment')

  const admin = await getSuperAdminOrThrow(targetId)

  const emailChanged = data.email !== undefined && data.email !== admin.email
  if (emailChanged) {
    const [existing] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, data.email!), ne(users.id, targetId)))
      .limit(1)
    if (existing) throw new Error('A user with this email already exists')
  }

  const attributes = [
    ...(data.name !== undefined ? [{ Name: 'name', Value: data.name ?? '' }] : []),
    ...(emailChanged ? [
      { Name: 'email', Value: data.email! },
      { Name: 'email_verified', Value: 'true' },
    ] : []),
  ]

  if (attributes.length > 0) {
    await cognito.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: USER_POOL_ID,
        Username: admin.email,
        UserAttributes: attributes,
      }),
    )
  }

  const [updated] = await db
    .update(users)
    .set({
      name: data.name !== undefined ? data.name : admin.name,
      email: data.email !== undefined ? data.email : admin.email,
      updatedAt: new Date(),
    })
    .where(eq(users.id, targetId))
    .returning()
  return updated
}

/** Permanently removes a super admin from Cognito and the DB. Blocked for self and for the last remaining super admin. */
export async function deleteSuperAdmin(actingUserId: number, targetId: number) {
  if (!USER_POOL_ID) throw new Error('COGNITO_USER_POOL_ID is not set in the environment')
  if (targetId === actingUserId) throw new Error('You cannot delete your own account')

  const admin = await getSuperAdminOrThrow(targetId)
  await assertNotLastSuperAdmin(targetId)

  try {
    await cognito.send(new AdminDeleteUserCommand({ UserPoolId: USER_POOL_ID, Username: admin.email }))
  } catch (err: unknown) {
    if (!(err instanceof Error && err.name === 'UserNotFoundException')) throw err
  }

  await db.delete(users).where(eq(users.id, targetId))
}
