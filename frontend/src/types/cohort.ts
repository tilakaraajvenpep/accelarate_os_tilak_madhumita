export interface Cohort {
  id: number
  tenantId: number
  name: string
  startDate: string
  endDate: string
  companyCount: number
  assignedPrograms: { id: number; name: string }[]
  createdAt: string
  updatedAt: string
}
