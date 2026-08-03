export type CompanyEntryStatus = 'active' | 'invited' | 'expired'

export interface CompanyEntry {
  id: string
  status: CompanyEntryStatus
  name: string | null
  founderUserId?: number | null
  founderName: string | null
  location: string | null
  establishedYear: number | null
  email: string
  cohortId: number | null
  cohortName: string | null
  createdAt: string
  allowedMenus?: string[] | null
  canSetPermissions?: boolean
}

export interface CompanyInviteResult {
  id: number
  email: string
  name: string | null
  status: string
}

export interface InviteDetails {
  email: string
  name: string | null
  tenantName: string
}

export interface Company {
  id: number
  tenantId: number
  founderUserId: number
  cohortId: number | null
  name: string | null
  location: string | null
  establishedYear: number | null
  founderName: string
  uen: string | null
  industry: string | null
  companySize: string | null
  roleInBusiness: string | null
  mobileNumber: string | null
  consentWhatsapp: boolean
  consentEmail: boolean
  platformScopeAck: boolean
  participationAuthorityAck: boolean
  status: 'draft' | 'locked'
  createdAt: string
  updatedAt: string
}
