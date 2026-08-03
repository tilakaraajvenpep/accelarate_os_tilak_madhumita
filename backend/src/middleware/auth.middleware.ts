import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'
import { getUserBySub } from '../services/users.service'
import type { User } from '../models'

const REGION = process.env.AWS_REGION || 'ap-southeast-1'
const POOL_ID = process.env.COGNITO_USER_POOL_ID!

const client = jwksClient({
  jwksUri: `https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}/.well-known/jwks.json`,
  cache: true,
  rateLimit: true,
})

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err)
    callback(null, key?.getPublicKey())
  })
}

export interface AuthRequest extends Request {
  user?: { sub: string }
  dbUser?: User
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const token = header.slice(7)
  jwt.verify(token, getKey, { algorithms: ['RS256'] }, (err, decoded) => {
    if (err) {
      res.status(401).json({ error: 'Invalid or expired token' })
      return
    }
    req.user = { sub: (decoded as jwt.JwtPayload).sub! }
    next()
  })
}

/** Loads the DB user row for the authenticated Cognito sub. Must run after requireAuth. */
export async function loadUser(req: AuthRequest, res: Response, next: NextFunction) {
  const user = await getUserBySub(req.user!.sub)
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  if (user.disabled) {
    res.status(403).json({ error: 'Your account has been disabled' })
    return
  }
  req.dbUser = user
  next()
}

/** Restricts a route to specific roles. Must run after requireAuth + loadUser.
 * An admin who opted into the "interested in mentoring" toggle is also let through
 * any route open to 'mentor' — they act as a mentor in addition to being an admin. */
export function requireRole(...roles: User['role'][]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const dbUser = req.dbUser
    const actingAsMentor = dbUser?.role === 'admin' && dbUser.interestedInMentoring && roles.includes('mentor')
    if (!dbUser || (!roles.includes(dbUser.role) && !actingAsMentor)) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }
    next()
  }
}
