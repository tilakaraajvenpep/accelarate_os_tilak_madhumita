import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { users } from '../models'

/**
 * Seeds a super_admin account for AOS-v2.
 *
 * It creates (or reuses) a Cognito user with a permanent, pre-verified password
 * — no email confirmation step needed — and then upserts the matching row in the
 * `users` table with role = 'super_admin'.
 *
 * IMPORTANT: the DB row is keyed on the Cognito `sub`. The login route
 * (`upsertUser`) looks users up by `cognitoSub` and preserves their role, so the
 * row created here is what makes you a super admin when you sign in.
 *
 * Configure via env (falls back to sensible defaults):
 *   SEED_SUPERADMIN_EMAIL     (default: superadmin@accelerateos.com)
 *   SEED_SUPERADMIN_PASSWORD  (default: AOS@SuperAdmin2026!)  ← change in prod
 *   SEED_SUPERADMIN_NAME      (default: Super Admin)
 *
 * Run:  npm run seed:superadmin
 */

const REGION =
  process.env.COGNITO_REGION || process.env.AWS_REGION || 'ap-southeast-1'
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} must be set (via Secrets Manager) — no hardcoded default credentials.`)
  }
  return value
}

const EMAIL = requireEnv('SEED_SUPERADMIN_EMAIL')
const PASSWORD = requireEnv('SEED_SUPERADMIN_PASSWORD')
const NAME = process.env.SEED_SUPERADMIN_NAME || 'Super Admin'

const cognito = new CognitoIdentityProviderClient({ region: REGION })

async function ensureCognitoUser(): Promise<string> {
  if (!USER_POOL_ID) {
    throw new Error('COGNITO_USER_POOL_ID is not set in the environment (.env)')
  }

  // 1. Create the user (suppress the invite email, mark email as verified).
  try {
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: EMAIL,
        MessageAction: 'SUPPRESS',
        UserAttributes: [
          { Name: 'email', Value: EMAIL },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'name', Value: NAME },
        ],
      }),
    )
    console.log(`  • Cognito user created: ${EMAIL}`)
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'UsernameExistsException') {
      console.log('  • Cognito user already exists — reusing it')
    } else {
      throw err
    }
  }

  // 2. Set a permanent password so the account is immediately usable.
  await cognito.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: EMAIL,
      Password: PASSWORD,
      Permanent: true,
    }),
  )
  console.log('  • Permanent password set')

  // 3. Fetch the canonical Cognito `sub` to key the DB row on.
  const details = await cognito.send(
    new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: EMAIL }),
  )
  const sub = details.UserAttributes?.find((a) => a.Name === 'sub')?.Value
  if (!sub) throw new Error('Could not resolve Cognito sub for the user')
  return sub
}

async function upsertSuperAdmin(cognitoSub: string) {
  // Match the row the login flow would key on (cognitoSub), then fall back to email.
  const [bySub] = await db
    .select()
    .from(users)
    .where(eq(users.cognitoSub, cognitoSub))
    .limit(1)

  if (bySub) {
    const [updated] = await db
      .update(users)
      .set({ role: 'super_admin', name: NAME, email: EMAIL, updatedAt: new Date() })
      .where(eq(users.id, bySub.id))
      .returning()
    return updated
  }

  const [byEmail] = await db
    .select()
    .from(users)
    .where(eq(users.email, EMAIL))
    .limit(1)

  if (byEmail) {
    const [updated] = await db
      .update(users)
      .set({ role: 'super_admin', name: NAME, cognitoSub, updatedAt: new Date() })
      .where(eq(users.id, byEmail.id))
      .returning()
    return updated
  }

  const [created] = await db
    .insert(users)
    .values({ cognitoSub, email: EMAIL, name: NAME, role: 'super_admin' })
    .returning()
  return created
}

export async function main() {
  console.log('Seeding AOS-v2 super admin…')
  const sub = await ensureCognitoUser()
  const user = await upsertSuperAdmin(sub)
  console.log('  • DB user synced:', {
    id: user.id,
    email: user.email,
    role: user.role,
  })
  console.log('\n✅ Super admin ready')
  console.log(`   Email:    ${EMAIL}`)
  console.log(`   Password: ${PASSWORD}`)
  console.log('   Sign in at /login\n')
}
