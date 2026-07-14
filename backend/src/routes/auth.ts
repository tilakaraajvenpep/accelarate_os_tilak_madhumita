import { Router, Request, Response } from 'express'
import { z } from 'zod'
import {
  cognitoSignUp,
  cognitoConfirmSignUp,
  cognitoSignIn,
  cognitoSignOut,
  cognitoForgotPassword,
  cognitoConfirmForgotPassword,
  cognitoResendCode,
  cognitoChangePassword,
} from '../services/auth.service'
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware'
import { upsertUser } from '../services/users.service'
import { generateUniqueSlug } from '../utils/slug'
import { db } from '../db/client'
import { tenants, users } from '../models'

/** Decode JWT payload without verifying — safe here since Cognito just issued it */
function decodeJwtPayload(token: string): Record<string, unknown> {
  const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
}

const router = Router()

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  organizationName: z.string().min(1).optional(),
  organizationType: z
    .enum(['university', 'corporate', 'vc_backed', 'government', 'independent', 'other'])
    .optional(),
  organizationWebsite: z.string().url().optional().or(z.literal('')),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

router.post('/register', async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const result = await cognitoSignUp(parsed.data.email, parsed.data.password, parsed.data.name)
    const cognitoSub = result.UserSub

    // Onboarding wizard sends organization fields — create the tenant + its
    // admin user row right away instead of waiting for first login, so the
    // org data collected in "Start your program" step 1 isn't discarded.
    if (parsed.data.organizationName && cognitoSub) {
      await db.transaction(async (tx) => {
        const slug = await generateUniqueSlug(parsed.data.organizationName!)
        const [tenant] = await tx
          .insert(tenants)
          .values({
            name: parsed.data.organizationName!,
            slug,
            orgType: parsed.data.organizationType ?? null,
            website: parsed.data.organizationWebsite || null,
          })
          .returning()

        await tx.insert(users).values({
          cognitoSub,
          email: parsed.data.email,
          name: parsed.data.name,
          role: 'admin',
          tenantId: tenant.id,
        })
      })
    }

    res.json({ message: 'Registered. Check your email for a verification code.' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Registration failed'
    res.status(400).json({ error: msg })
  }
})

router.post('/verify-email', async (req: Request, res: Response) => {
  const { email, code } = req.body as { email?: string; code?: string }
  if (!email || !code) {
    res.status(400).json({ error: 'email and code are required' })
    return
  }
  try {
    await cognitoConfirmSignUp(email, code)
    res.json({ message: 'Email verified. You can now sign in.' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Verification failed'
    res.status(400).json({ error: msg })
  }
})

router.post('/resend-code', async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string }
  if (!email) {
    res.status(400).json({ error: 'email is required' })
    return
  }
  try {
    await cognitoResendCode(email)
    res.json({ message: 'Code resent.' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to resend code'
    res.status(400).json({ error: msg })
  }
})

router.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const result = await cognitoSignIn(parsed.data.email, parsed.data.password)
    const t = result.AuthenticationResult
    if (!t?.IdToken || !t?.AccessToken) throw new Error('Missing tokens from Cognito')

    // Sync user to DB using ID-token claims
    const claims = decodeJwtPayload(t.IdToken)
    const user = await upsertUser({
      cognitoSub: claims.sub as string,
      email: (claims.email as string) || parsed.data.email,
      name: (claims.name as string | undefined) ?? null,
    })

    if (!user.emailVerified) {
      res.status(403).json({ error: 'Please verify your email before signing in — check your inbox for the verification link.' })
      return
    }

    if (user.role === 'super_admin' && user.disabled) {
      res.status(403).json({ error: 'This super admin account has been deactivated.' })
      return
    }

    res.json({
      accessToken: t.AccessToken,
      idToken: t.IdToken,
      refreshToken: t.RefreshToken,
      expiresIn: t.ExpiresIn,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Login failed'
    res.status(401).json({ error: msg })
  }
})

router.post('/logout', async (req: Request, res: Response) => {
  const { accessToken } = req.body as { accessToken?: string }
  if (!accessToken) {
    res.status(400).json({ error: 'accessToken is required' })
    return
  }
  try {
    await cognitoSignOut(accessToken)
    res.json({ message: 'Signed out.' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Logout failed'
    res.status(400).json({ error: msg })
  }
})

router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string }
  if (!email) {
    res.status(400).json({ error: 'email is required' })
    return
  }
  try {
    await cognitoForgotPassword(email)
    res.json({ message: 'Reset code sent to your email.' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to send reset code'
    res.status(400).json({ error: msg })
  }
})

router.post('/reset-password', async (req: Request, res: Response) => {
  const { email, code, newPassword } = req.body as {
    email?: string
    code?: string
    newPassword?: string
  }
  if (!email || !code || !newPassword) {
    res.status(400).json({ error: 'email, code and newPassword are required' })
    return
  }
  try {
    await cognitoConfirmForgotPassword(email, code, newPassword)
    res.json({ message: 'Password reset. You can now sign in.' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Reset failed'
    res.status(400).json({ error: msg })
  }
})

router.post('/change-password', requireAuth, async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string }
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'currentPassword and newPassword are required' })
    return
  }
  const accessToken = req.headers.authorization!.slice(7)
  try {
    await cognitoChangePassword(accessToken, currentPassword, newPassword)
    res.json({ message: 'Password changed.' })
  } catch (err: unknown) {
    const msg =
      err instanceof Error && err.name === 'NotAuthorizedException'
        ? 'Incorrect current password.'
        : err instanceof Error
          ? err.message
          : 'Failed to change password'
    res.status(400).json({ error: msg })
  }
})

export default router
