import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Building2, Search, FileText, ChevronRight, HelpCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/auth-context'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Loader } from '@/components/ui/loader'
import { DocumentPreview } from '@/components/document-preview'
import type { CompanyEntry } from '@/types/company'
import type { Cohort } from '@/types/cohort'
import type { CompanyFormAnswer } from '@/components/form-answers-dialog'

function formatQuestionTitle(title: string): string {
  if (!title) return title
  let formatted = title.startsWith('_') ? title.slice(1) : title
  if (!formatted.includes(' ')) {
    formatted = formatted.replace(/[_-]+/g, ' ')
    formatted = formatted.replace(/([a-z])([A-Z])/g, '$1 $2')
    formatted = formatted
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }
  return formatted
}

function formatAnswerValue(value: unknown, t: (key: string) => string, questionTitle?: string): string {
  if (value === undefined || value === null || value === '') return '—'
  if (Array.isArray(value)) {
    return value.map((v) => formatAnswerValue(v, t, questionTitle)).join(', ')
  }
  if (typeof value === 'boolean') {
    if (questionTitle?.toLowerCase().includes('consent') || questionTitle?.toLowerCase().includes('agree')) {
      return value ? t('submittedAnswers.accepted') : t('submittedAnswers.declined')
    }
    return value ? t('common:yes') : t('common:no')
  }
  if (typeof value === 'string') {
    const valLower = value.toLowerCase().trim()
    if (valLower === 'true') {
      if (questionTitle?.toLowerCase().includes('consent') || questionTitle?.toLowerCase().includes('agree')) {
        return t('submittedAnswers.accepted')
      }
      return t('common:yes')
    }
    if (valLower === 'false') {
      if (questionTitle?.toLowerCase().includes('consent') || questionTitle?.toLowerCase().includes('agree')) {
        return t('submittedAnswers.declined')
      }
      return t('common:no')
    }
  }
  return String(value)
}

export default function SubmittedAnswersPage() {
  const { user } = useAuth()
  const { t } = useTranslation('cohorts')
  const [selectedCohortId, setSelectedCohortId] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedCompany, setSelectedCompany] = useState<{ id: number; name: string; cohortId: number; founderName: string | null } | null>(null)

  const isMentor = user?.role === 'mentor'
  const isAdmin = user?.role === 'admin'

  // 1. Fetch cohorts to populate the cohort filter dropdown
  const { data: adminCohorts = [] } = useQuery({
    queryKey: ['cohorts-list'],
    queryFn: async () => (await api.get<Cohort[]>('/api/tenants/me/cohorts')).data,
    enabled: isAdmin,
  })

  const { data: mentorAssignments = [] } = useQuery({
    queryKey: ['mentor-self-assignments'],
    queryFn: async () => (await api.get<{ cohortId: number; cohortName: string }[]>('/api/tenants/me/mentor/assignments')).data,
    enabled: isMentor,
  })

  const mentorCohorts = Array.from(
    new Map(mentorAssignments.map((a) => [a.cohortId, { id: a.cohortId, name: a.cohortName }])).values()
  )

  const cohorts = isAdmin ? adminCohorts : mentorCohorts

  // 2. Fetch all companies
  const { data: adminCompanies = [], isLoading: adminCompaniesLoading } = useQuery({
    queryKey: ['company-entries-all'],
    queryFn: async () => (await api.get<CompanyEntry[]>('/api/tenants/me/companies')).data,
    enabled: isAdmin,
  })

  const { data: mentorCompanies = [], isLoading: mentorCompaniesLoading } = useQuery({
    queryKey: ['mentor-cohort-companies', selectedCohortId, mentorCohorts.map(c => c.id).join(',')],
    queryFn: async () => {
      if (selectedCohortId === 'all') {
        const promises = mentorCohorts.map((c) =>
          api.get<CompanyEntry[]>(`/api/tenants/me/mentor/cohorts/${c.id}/companies`)
        )
        const results = await Promise.all(promises)
        return results.flatMap((r) => r.data)
      } else {
        return (await api.get<CompanyEntry[]>(`/api/tenants/me/mentor/cohorts/${selectedCohortId}/companies`)).data
      }
    },
    enabled: isMentor && (selectedCohortId !== 'all' || mentorCohorts.length > 0),
  })

  const entries = isAdmin ? adminCompanies : mentorCompanies
  const companiesLoading = isAdmin ? adminCompaniesLoading : mentorCompaniesLoading

  // 3. Filter active companies by search query and cohort selection
  const activeCompanies = entries.filter((c) => {
    if (c.status !== 'active') return false
    if (selectedCohortId !== 'all' && String(c.cohortId) !== selectedCohortId) return false
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      const companyName = (c.name || '').toLowerCase()
      const founderName = (c.founderName || '').toLowerCase()
      return companyName.includes(query) || founderName.includes(query)
    }
    return true
  })

  // 4. Fetch the selected company's submitted answers
  const { data: answers = [], isLoading: answersLoading } = useQuery({
    queryKey: ['company-submitted-answers', selectedCompany?.cohortId, selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany) return []
      const url = isAdmin
        ? `/api/tenants/me/cohorts/${selectedCompany.cohortId}/companies/${selectedCompany.id}/form-answers`
        : `/api/tenants/me/mentor/cohorts/${selectedCompany.cohortId}/companies/${selectedCompany.id}/form-answers`
      return (await api.get<CompanyFormAnswer[]>(url)).data
    },
    enabled: !!selectedCompany,
  })

  if (!isAdmin && !isMentor) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        {t('notAvailable')}
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('submittedAnswers.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t('submittedAnswers.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left Side: Filter and List of active companies */}
        <div className="md:col-span-4 space-y-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {t('submittedAnswers.activeCompanies')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              {/* Cohort Select Filter */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t('submittedAnswers.filterByCohort')}</label>
                <Select value={selectedCohortId} onValueChange={(val) => { if (val !== null) { setSelectedCohortId(val); setSelectedCompany(null); } }}>
                  <SelectTrigger className="w-full h-9">
                    <SelectValue placeholder={t('submittedAnswers.allCohorts')}>
                      {(v: string) => (v === 'all' ? t('submittedAnswers.allCohorts') : cohorts.find((c) => String(c.id) === v)?.name ?? v)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('submittedAnswers.allCohorts')}</SelectItem>
                    {cohorts.map((cohort) => (
                      <SelectItem key={cohort.id} value={String(cohort.id)}>
                        {cohort.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('submittedAnswers.searchPlaceholder')}
                  className="pl-8 h-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Companies List */}
          <Card className="overflow-hidden">
            <div className="divide-y max-h-[60vh] overflow-y-auto">
              {companiesLoading ? (
                <div className="p-6 flex justify-center">
                  <Loader />
                </div>
              ) : activeCompanies.length === 0 ? (
                <div className="p-8 text-center">
                  <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">{t('submittedAnswers.noCompanies')}</p>
                </div>
              ) : (
                activeCompanies.map((entry) => {
                  const companyId = Number(entry.id.replace('company-', ''))
                  const isSelected = selectedCompany?.id === companyId
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() =>
                          setSelectedCompany({
                            id: companyId,
                            name: entry.name || t('submittedAnswers.pendingSetup'),
                            cohortId: entry.cohortId || 0,
                            founderName: entry.founderName,
                          })
                      }
                      className={`w-full text-left p-3.5 transition-colors flex items-center justify-between hover:bg-muted/50 ${
                        isSelected ? 'bg-primary/5 hover:bg-primary/5 border-l-4 border-primary pl-2.5' : ''
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold text-sm truncate text-foreground">
                          {entry.name || t('submittedAnswers.pendingSetup')}
                        </p>
                        <div className="flex flex-col gap-0.5 mt-1 text-xs text-muted-foreground">
                          <span>{t('submittedAnswers.founderLabel', { name: entry.founderName || '—' })}</span>
                          <span>{t('submittedAnswers.cohortLabel', { name: entry.cohortName || '—' })}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  )
                })
              )}
            </div>
          </Card>
        </div>

        {/* Right Side: Form answers viewer */}
        <div className="md:col-span-8">
          {!selectedCompany ? (
            <Card className="border border-dashed p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg">{t('submittedAnswers.selectCompany')}</h3>
              <p className="text-muted-foreground text-sm max-w-sm mt-1">
                {t('submittedAnswers.selectCompanyHint')}
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h2 className="text-xl font-bold text-foreground">{selectedCompany.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {t('submittedAnswers.founderLabel', { name: selectedCompany.founderName || '—' })}
                  </p>
                </div>
              </div>

              {answersLoading ? (
                <div className="p-12 flex justify-center">
                  <Loader />
                </div>
              ) : answers.length === 0 ? (
                <Card className="p-8 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">{t('submittedAnswers.noSubmissions')}</p>
                </Card>
              ) : (
                <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
                  {answers.map((submission, index) => (
                    <Card key={index}>
                      <CardHeader className="bg-muted/30 border-b p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                              {t('submittedAnswers.formName')}
                            </span>
                            <CardTitle className="text-base font-bold text-foreground">
                              {submission.formName}
                            </CardTitle>
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1 md:text-right">
                              {t('submittedAnswers.programName')}
                            </span>
                            <div className="md:text-right">
                              <div className="inline-block text-xs font-medium bg-background px-2.5 py-1 rounded-md border text-left">
                                {submission.programName} &middot; {submission.pillarTitle} &middot; {submission.sectionTitle}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 space-y-4">
                        {submission.answers.length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">{t('submittedAnswers.noQuestions')}</p>
                        ) : (
                          <div className="divide-y divide-border">
                            {submission.answers.map((ans, idx) => (
                              <div key={idx} className="py-3.5 first:pt-0 last:pb-0 space-y-2">
                                <div className="space-y-1">
                                  <span className="text-[10px] font-semibold text-muted-foreground/75 uppercase tracking-wider block">{t('submittedAnswers.question')}</span>
                                  <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                                    <HelpCircle className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                                    {formatQuestionTitle(ans.questionTitle)}
                                  </p>
                                </div>
                                <div className="pl-5 space-y-1">
                                  <span className="text-[10px] font-semibold text-muted-foreground/75 uppercase tracking-wider block">{t('submittedAnswers.answer')}</span>
                                  <p className="text-sm text-foreground break-words whitespace-pre-wrap">
                                    {formatAnswerValue(ans.value, t, ans.questionTitle)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {submission.document && (
                          <DocumentPreview
                            fetchUrl={`${
                              isAdmin
                                ? `/api/tenants/me/cohorts/${selectedCompany.cohortId}/companies/${selectedCompany.id}`
                                : `/api/tenants/me/mentor/cohorts/${selectedCompany.cohortId}/companies/${selectedCompany.id}`
                            }/sections/${submission.sectionId}/forms/${submission.formId}/document`}
                            fileName={submission.document.fileName}
                          />
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
