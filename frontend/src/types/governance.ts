export interface GovernanceConfig {
  id: number
  tenantId: number
  cohortId: number | null
  applicablePillars: number[]
  purpose: string | null
  createdAt: string
  updatedAt: string
}

export type GovernanceSessionStatus = 'draft' | 'submitted' | 'reviewed'

export interface GovernanceSession {
  id: number
  tenantId: number
  configId: number
  companyId: number
  status: GovernanceSessionStatus
  founderNotes: string | null
  feedback: string | null
  outcome: string | null
  documentGeneratedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface PillarDefinition {
  id: number
  tenantId: number
  pillarNumber: number
  title: string | null
}
