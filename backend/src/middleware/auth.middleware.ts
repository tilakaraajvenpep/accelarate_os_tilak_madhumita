import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'

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
