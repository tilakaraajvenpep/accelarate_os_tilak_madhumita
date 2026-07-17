export type CompanyEntryStatus = 'active' | 'invited' | 'expired'

/** A row in the tenant admin's Companies list — either a completed company or a still-pending invite. */
export interface CompanyEntry {
  id: string
  status: CompanyEntryStatus
  name: string | null
  founderName: string | null
  location: string | null
  establishedYear: number | null
  email: string
  createdAt: string
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
  name: string
  location: string | null
  establishedYear: number | null
  founderName: string
  createdAt: string
  updatedAt: string
}
