export type UserRole = 'founder' | 'admin' | 'super_admin' | 'mentor' | 'funding_team'

export interface AuthUser {
  id: number
  email: string
  name: string | null
  role: UserRole
  tenantId: number | null
  tenantSlug: string | null
  // Admin-only: opted into the "interested in mentoring" toggle in Settings — grants
  // mentor-section sidebar access and mentor API routes alongside their admin role.
  interestedInMentoring?: boolean
  allowedMenus?: string[] | null
  canSetPermissions?: boolean
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

export interface RegisterResponse {
  message: string
  tenantSlug: string | null
}
