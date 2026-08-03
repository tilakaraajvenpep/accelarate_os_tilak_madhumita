export type EntityStatus = 'active' | 'inactive'

export interface Program {
  id: number
  tenantId: number
  name: string
  description: string | null
  sortOrder: number
  status: EntityStatus
  locked: boolean
  // Non-empty once at least one pillar/section of this program has been scheduled onto a
  // cohort's calendar — while non-empty, the program's name/description and its pillars/
  // sections structure can't be edited (see programDetail.assignedToCohortHint).
  assignedCohorts: { id: number; name: string }[]
  createdAt: string
  updatedAt: string
}

export interface Pillar {
  id: number
  title: string
  description: string | null
  programObjective: string | null
  phaseCoverage: string | null
  expectedOutcomes: string | null
  founderExpectation: string | null
  programId: number | null
  programName: string | null
  sortOrder: number
  // When true, this pillar executes in parallel with the pillar immediately
  // before it (they form one parallel group) instead of after it.
  parallelWithPrevious: boolean
  status: EntityStatus
  // 'learning' = complete once every section's forms are submitted (unchanged
  // behavior). 'assessment' additionally requires the rolled-up score from
  // scored answer options to reach passThreshold — see founder-programs.service.ts.
  purpose: 'learning' | 'assessment'
  passThreshold: number | null
  // When false, this pillar doesn't block a program's overall completion even
  // if left unfinished — always true for learning pillars.
  mandatory: boolean
  showInCalendar: boolean
  locked: boolean
  // When true, founders must fill out this pillar's readiness-checklist questions
  // (self-report, authored below) alongside its forms.
  hasReadinessChecklist: boolean
  hasKeyTakeawaysAndDiscussions: boolean
  createdAt: string
  updatedAt: string
}

export interface PillarChecklistQuestion {
  id: number
  prompt: string
  type: 'text' | 'checkbox'
  sortOrder: number
}

export interface SectionFormRef {
  id: number
  name: string
  // 'primary_founder' = only the company's original founder may fill this in;
  // 'first_claim' = any team member, but whoever saves first locks the rest out.
  fillPolicy: 'primary_founder' | 'first_claim'
}

export interface PillarSectionRow {
  pillarSectionId: number
  sortOrder: number
  sectionId: number
  title: string
  description: string | null
  status: EntityStatus
  showInCalendar: boolean
  locked: boolean
  forms: SectionFormRef[]
}

export interface PillarDetail extends Pillar {
  sections: PillarSectionRow[]
  checklistQuestions: PillarChecklistQuestion[]
}

export interface Section {
  id: number
  title: string
  description: string | null
  status: EntityStatus
  showInCalendar: boolean
  locked: boolean
  forms: SectionFormRef[]
  createdAt: string
  updatedAt: string
}
