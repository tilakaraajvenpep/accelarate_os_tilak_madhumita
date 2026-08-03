export interface CohortTask {
  id: number
  cohortId: number
  companyId: number | null
  companyName: string | null
  programId: number | null
  programName: string | null
  title: string
  description: string | null
  startDate: string | null
  endDate: string | null
  createdByUserId: number
  createdByName: string | null
  createdAt: string
  updatedAt: string
}
