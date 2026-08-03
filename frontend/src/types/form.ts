export type FormStatus = 'active' | 'inactive'

export type SimpleQuestionType = 'short_text' | 'long_text' | 'number' | 'single_choice' | 'multiple_choice' | 'date'

export interface SimpleFormQuestion {
  id: string
  title: string
  type: SimpleQuestionType
  required?: boolean
  helpText?: string | null
  options?: string[] // single_choice / multiple_choice only
}

export interface FormEntry {
  id: number
  tenantId: number
  name: string
  status: FormStatus
  schema: SimpleFormQuestion[]
  createdAt: string
  updatedAt: string
}
