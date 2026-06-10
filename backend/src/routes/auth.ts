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
} from '../services/auth.service'
import { upsertUser } from '../services/users.service'

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
    await cognitoSignUp(parsed.data.email, parsed.data.password, parsed.data.name)
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

export default router
