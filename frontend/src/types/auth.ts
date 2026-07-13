export type UserRole = 'founder' | 'admin' | 'super_admin' | 'mentor' | 'funding_team'

export interface AuthUser {
  id: number
  email: string
  name: string | null
  role: UserRole
  tenantId: number | null
}

export interface AuthTokens {
  accessToken: string
  idToken: string
  refreshToken: string
  expiresIn: number
}

export interface LoginResponse extends AuthTokens {
  user: AuthUser
}
