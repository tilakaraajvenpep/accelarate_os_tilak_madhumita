import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import type { LoginResponse } from '@/types/auth'
import type { InviteDetails, Company } from '@/types/company'
import { ThemeToggle } from '@/components/theme-toggle'
import { LanguageSwitcher } from '@/components/language-switcher'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { DynamicForm } from '@/components/dynamic-form'
import type { FormQuestion } from '@/types/forms'

interface TenantOnboardingForm {
  mappingId: number
  templateId: number
  title: string
  schema: FormQuestion[]
  category: string
  requireConsent: boolean
  consentTermsText: string | null
}

function findAnswerByKeywords(
  schema: FormQuestion[],
  responseJson: Record<string, unknown>,
  keywordGroups: string[][],
  excludeQuestionId?: string,
): { questionId: string; value: string } | null {
  for (const keywords of keywordGroups) {
    const question = schema.find((q) => {
      if (q.id === excludeQuestionId) return false
      const haystack = `${q.id} ${q.title}`.toLowerCase()
      return keywords.every((k) => haystack.includes(k))
    })
    if (question) {
      const value = responseJson[question.id]
      if (typeof value === 'string' && value.trim().length > 0) return { questionId: question.id, value: value.trim() }
    }
  }
  return null
}

function resolveNameField(
  schema: FormQuestion[],
  responseJson: Record<string, unknown>,
  strictGroups: string[][],
  excludeQuestionId?: string,
): { questionId: string; value: string } | null {
  return (
    findAnswerByKeywords(schema, responseJson, strictGroups, excludeQuestionId) ??
    findAnswerByKeywords(schema, responseJson, [['name']], excludeQuestionId)
  )
}

function extractCompanyFieldsFromResponse(schema: FormQuestion[], responseJson: Record<string, unknown>) {
  const name = resolveNameField(schema, responseJson, [['brand', 'name'], ['business', 'name'], ['company', 'name']])?.value ?? ''
  const uen = findAnswerByKeywords(schema, responseJson, [['uen'], ['unique', 'entity']])?.value ?? ''
  const industry = findAnswerByKeywords(schema, responseJson, [['industry']])?.value ?? ''
  const companySize = findAnswerByKeywords(schema, responseJson, [['size'], ['employee']])?.value ?? ''
  const roleInBusiness = findAnswerByKeywords(schema, responseJson, [['role'], ['designation']])?.value ?? ''
  const mobileNumber = findAnswerByKeywords(schema, responseJson, [['mobile'], ['phone'], ['contact']])?.value ?? ''

  const whatsappQuestion = schema.find(q => q.id.includes('whatsapp') || q.title.toLowerCase().includes('whatsapp'))
  const consentWhatsapp = whatsappQuestion ? (responseJson[whatsappQuestion.id] as string[])?.length > 0 : false

  const emailQuestion = schema.find(q => q.id.includes('email') || q.title.toLowerCase().includes('email'))
  const consentEmail = emailQuestion ? (responseJson[emailQuestion.id] as string[])?.length > 0 : false

  const scopeQuestion = schema.find(q => q.id.includes('scope') || q.title.toLowerCase().includes('scope') || q.title.toLowerCase().includes('platform'))
  const platformScopeAck = scopeQuestion ? (responseJson[scopeQuestion.id] as string[])?.length > 0 : false

  const authQuestion = schema.find(q => q.id.includes('authority') || q.title.toLowerCase().includes('authority') || q.title.toLowerCase().includes('participation'))
  const participationAuthorityAck = authQuestion ? (responseJson[authQuestion.id] as string[])?.length > 0 : false

  return {
    name,
    uen,
    industry,
    companySize,
    roleInBusiness,
    mobileNumber,
    consentWhatsapp,
    consentEmail,
    platformScopeAck,
    participationAuthorityAck,
  }
}


type Step = 'password' | 'company'

const INDUSTRY_OPTIONS = [
  'Technology', 'Healthcare', 'Finance', 'Retail / E-commerce', 'Manufacturing',
  'Education', 'Food & Beverage', 'Real Estate', 'Professional Services', 'Other',
]
const ROLE_OPTIONS = ['Founder / CEO', 'Co-Founder', 'CTO', 'COO', 'CFO', 'Other']
const COMPANY_SIZE_OPTIONS: { value: string; label: string }[] = [
  { value: 'solo', label: 'Solo' },
  { value: '2-10', label: '2-10' },
  { value: '11-50', label: '11-50' },
  { value: '50+', label: '50+' },
]

interface CompanyDraftState {
  name: string
  uen: string
  industry: string
  companySize: string
  roleInBusiness: string
  mobileNumber: string
  consentWhatsapp: boolean
  consentEmail: boolean
  platformScopeAck: boolean
  participationAuthorityAck: boolean
}

const EMPTY_DRAFT: CompanyDraftState = {
  name: '',
  uen: '',
  industry: '',
  companySize: '',
  roleInBusiness: '',
  mobileNumber: '',
  consentWhatsapp: false,
  consentEmail: false,
  platformScopeAck: false,
  participationAuthorityAck: false,
}

type DraftErrors = Partial<Record<keyof CompanyDraftState, boolean>>

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error
    ?? (err instanceof Error ? err.message : fallback)
}

export default function AcceptInvitePage() {
  const navigate = useNavigate()
  const { t } = useTranslation('acceptInvite')
  const { user, loading: authLoading, adoptSession } = useAuth()
  const queryClient = useQueryClient()
  const token = new URLSearchParams(window.location.search).get('token') ?? ''

  const [step, setStep] = useState<Step>('password')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordErrors, setPasswordErrors] = useState<{ fullName?: boolean; password?: boolean; confirmPassword?: boolean }>({})

  // Already authenticated (a fresh accept just now, or a returning visit — the
  // session survives page reloads/tab closes via localStorage, see auth-context.tsx)
  // and a founder: check the company-onboarding status independent of the invite
  // token. The token is consumed for good the moment the password step succeeds
  // (tenantInvites.status flips to 'accepted'), so a reload/re-visit after that
  // point would otherwise only ever see "this invite link is invalid or expired"
  // with no way back in — this is what lets the founder resume instead of losing
  // their spot in onboarding.
  const isAuthenticatedFounder = !!user && user.role === 'founder'
  const { data: myCompany, isLoading: myCompanyLoading } = useQuery({
    queryKey: ['my-company-onboarding-check'],
    queryFn: async () => (await api.get<Company>('/api/tenants/me/companies/mine')).data,
    enabled: isAuthenticatedFounder,
  })

  useEffect(() => {
    if (isAuthenticatedFounder && myCompany?.status === 'locked') {
      navigate('/', { replace: true })
    }
  }, [isAuthenticatedFounder, myCompany, navigate])

  if (isAuthenticatedFounder && myCompany !== undefined && myCompany.status !== 'locked' && step === 'password') {
    setStep('company')
  }

  const { data: invite, isLoading: inviteLoading, isError: inviteInvalid } = useQuery({
    queryKey: ['invite-details', token],
    queryFn: async () => (await api.get<InviteDetails>(`/api/invites/${token}`)).data,
    enabled: !!token && !isAuthenticatedFounder,
    retry: false,
  })

  const acceptMutation = useMutation({
    mutationFn: async () => (await api.post<LoginResponse>(`/api/invites/${token}/accept`, { password, fullName })).data,
    onSuccess: (data) => {
      const { user, ...tokens } = data
      adoptSession(tokens, user)
      setStep('company')
    },
    onError: (err) => toast.error(apiError(err, t('password.failed'))),
  })

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errors: typeof passwordErrors = {}
    if (!fullName.trim()) errors.fullName = true
    if (password.length < 8) errors.password = true
    if (password !== confirmPassword) errors.confirmPassword = true
    setPasswordErrors(errors)
    if (errors.fullName) { toast.error(t('password.fullNameRequired')); return }
    if (errors.password) { toast.error(t('password.tooShort')); return }
    if (errors.confirmPassword) { toast.error(t('password.mismatch')); return }
    acceptMutation.mutate()
  }

  // Company step — seeded from the fetched draft (auto-created server-side the
  // moment we're authenticated) so Save Draft is genuinely resumable across
  // sessions, not just within this page load.
  const [draft, setDraft] = useState<CompanyDraftState>(EMPTY_DRAFT)
  const [draftErrors, setDraftErrors] = useState<DraftErrors>({})
  const [seededFor, setSeededFor] = useState<number | null>(null)

  if (myCompany && myCompany.id !== seededFor) {
    setSeededFor(myCompany.id)
    setDraft({
      name: myCompany.name ?? '',
      uen: myCompany.uen ?? '',
      industry: myCompany.industry ?? '',
      companySize: myCompany.companySize ?? '',
      roleInBusiness: myCompany.roleInBusiness ?? '',
      mobileNumber: myCompany.mobileNumber ?? '',
      consentWhatsapp: myCompany.consentWhatsapp,
      consentEmail: myCompany.consentEmail,
      platformScopeAck: myCompany.platformScopeAck,
      participationAuthorityAck: myCompany.participationAuthorityAck,
    })
  }

  const { data: onboardingForm, isLoading: onboardingFormLoading } = useQuery({
    queryKey: ['tenant-onboarding-form'],
    queryFn: async () => (await api.get<TenantOnboardingForm | null>('/api/platform/tenant-onboarding-form')).data,
    enabled: step === 'company',
  })

  const [initialData, setInitialData] = useState<Record<string, any>>({})
  const [initialDataSeeded, setInitialDataSeeded] = useState(false)

  useEffect(() => {
    if (myCompany && onboardingForm && !initialDataSeeded) {
      const data: Record<string, any> = {}
      data['company_name'] = myCompany.name ?? ''
      data['uen'] = myCompany.uen ?? ''
      data['industry'] = myCompany.industry ?? ''
      data['company_size'] = myCompany.companySize ?? ''
      data['full_name'] = user?.name ?? ''
      data['role_in_business'] = myCompany.roleInBusiness ?? ''
      data['email_address'] = user?.email ?? ''
      data['mobile_number'] = myCompany.mobileNumber ?? ''

      const whatsappQuestion = onboardingForm.schema.find(q => q.id.includes('whatsapp') || q.title.toLowerCase().includes('whatsapp'))
      if (whatsappQuestion && myCompany.consentWhatsapp) {
        data[whatsappQuestion.id] = whatsappQuestion.options?.map(o => o.label) ?? []
      }

      const emailQuestion = onboardingForm.schema.find(q => q.id.includes('email') || q.title.toLowerCase().includes('email'))
      if (emailQuestion && myCompany.consentEmail) {
        data[emailQuestion.id] = emailQuestion.options?.map(o => o.label) ?? []
      }

      const scopeQuestion = onboardingForm.schema.find(q => q.id.includes('scope') || q.title.toLowerCase().includes('scope') || q.title.toLowerCase().includes('platform'))
      if (scopeQuestion && myCompany.platformScopeAck) {
        data[scopeQuestion.id] = scopeQuestion.options?.map(o => o.label) ?? []
      }

      const authQuestion = onboardingForm.schema.find(q => q.id.includes('authority') || q.title.toLowerCase().includes('authority') || q.title.toLowerCase().includes('participation'))
      if (authQuestion && myCompany.participationAuthorityAck) {
        data[authQuestion.id] = authQuestion.options?.map(o => o.label) ?? []
      }

      setInitialData(data)
      setInitialDataSeeded(true)
    }
  }, [myCompany, onboardingForm, user, initialDataSeeded])

  function updateDraft<K extends keyof CompanyDraftState>(key: K, value: CompanyDraftState[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
    if (draftErrors[key]) setDraftErrors((current) => ({ ...current, [key]: false }))
  }

  const saveDraftMutation = useMutation({
    mutationFn: async (payload?: any) =>
      (
        await api.patch<Company>('/api/tenants/me/companies/mine/draft', payload ?? {
          name: draft.name || null,
          uen: draft.uen || null,
          industry: draft.industry || null,
          companySize: draft.companySize || null,
          roleInBusiness: draft.roleInBusiness || null,
          mobileNumber: draft.mobileNumber || null,
          consentWhatsapp: draft.consentWhatsapp,
          consentEmail: draft.consentEmail,
        })
      ).data,
    onSuccess: () => {
      toast.success(t('company.toast.draftSaved'))
      queryClient.invalidateQueries({ queryKey: ['my-company-onboarding-check'] })
    },
    onError: (err) => toast.error(apiError(err, t('company.toast.saveFailed'))),
  })

  const lockMutation = useMutation({
    mutationFn: async (payload?: any) =>
      (
        await api.post<Company>('/api/tenants/me/companies/mine/lock', payload ?? {
          name: draft.name,
          uen: draft.uen || null,
          industry: draft.industry,
          companySize: draft.companySize,
          roleInBusiness: draft.roleInBusiness,
          mobileNumber: draft.mobileNumber,
          consentWhatsapp: draft.consentWhatsapp,
          consentEmail: draft.consentEmail,
          platformScopeAck: draft.platformScopeAck,
          participationAuthorityAck: draft.participationAuthorityAck,
        })
      ).data,
    onSuccess: () => {
      toast.success(t('company.toast.locked'))
      navigate('/', { replace: true })
    },
    onError: (err) => toast.error(apiError(err, t('company.toast.lockFailed'))),
  })

  function handleLockClick() {
    const errors: DraftErrors = {}
    if (!draft.name.trim()) errors.name = true
    if (!draft.industry) errors.industry = true
    if (!draft.companySize) errors.companySize = true
    if (!draft.roleInBusiness) errors.roleInBusiness = true
    if (!draft.mobileNumber.trim()) errors.mobileNumber = true
    if (!draft.platformScopeAck) errors.platformScopeAck = true
    if (!draft.participationAuthorityAck) errors.participationAuthorityAck = true
    setDraftErrors(errors)
    if (Object.keys(errors).length > 0) {
      toast.error(t('company.toast.missingFields'))
      return
    }
    lockMutation.mutate(undefined)
  }

  return (
    <div className="relative min-h-screen bg-page text-ink overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-[oklch(0.55_0.22_265)] opacity-[0.18] blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[500px] w-[450px] rounded-full bg-[oklch(0.58_0.22_30)] opacity-[0.12] blur-[130px]" />
      </div>

      <nav className="relative z-10 border-b border-glass-border bg-page/80 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <a href="/" className="group flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-gradient-accent shadow-md ring-1 ring-white/10 flex items-center justify-center text-white font-bold text-sm transition-transform duration-200 group-hover:scale-105">A</div>
            <span className="font-semibold tracking-tight">AccelerateOS</span>
          </a>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div className={cn('relative z-10 mx-auto px-6 py-16', step === 'company' ? 'max-w-3xl' : 'max-w-lg')}>
        {authLoading || (isAuthenticatedFounder && myCompanyLoading) ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-ink/40" />
          </div>
        ) : !isAuthenticatedFounder && (!token || inviteInvalid) ? (
          <div className="text-center space-y-4 py-16">
            <div className="inline-flex h-16 w-16 rounded-full bg-glass border border-glass-border shadow-sm items-center justify-center mx-auto">
              <AlertCircle className="h-7 w-7 text-destructive" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">{t('invalid.title')}</h1>
              <p className="text-sm text-ink/40 mt-1">{t('invalid.subtitle')}</p>
            </div>
          </div>
        ) : !isAuthenticatedFounder && inviteLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-ink/40" />
          </div>
        ) : (
          <>
            {step === 'password' && (
              <form noValidate onSubmit={handlePasswordSubmit} className="space-y-6 rounded-2xl border border-glass-border bg-glass backdrop-blur-xl shadow-xl p-8 sm:p-10">
                <div>
                  <h1 className="text-2xl font-semibold mb-1">{t('password.title')}</h1>
                  <p className="text-sm text-ink/40">
                    {t('password.subtitlePrefix')} <span className="text-ink/70 font-medium">{invite?.email}</span>
                  </p>
                </div>

                <div className="space-y-4">
                  <FormField label={t('password.fullNameLabel')} required>
                    <GlassInput
                      placeholder={t('password.fullNamePlaceholder')}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      error={passwordErrors.fullName}
                      autoFocus
                    />
                  </FormField>
                  <FormField label={t('password.passwordLabel')} required>
                    <GlassPasswordInput
                      placeholder={t('password.passwordPlaceholder')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      error={passwordErrors.password}
                      minLength={8}
                    />
                  </FormField>
                  <FormField label={t('password.confirmLabel')} required>
                    <GlassPasswordInput
                      placeholder={t('password.confirmPlaceholder')}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      error={passwordErrors.confirmPassword}
                      minLength={8}
                    />
                  </FormField>
                </div>

                <PrimaryButton loading={acceptMutation.isPending}>{t('password.continueButton')}</PrimaryButton>
              </form>
            )}

            {step === 'company' && onboardingFormLoading && (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-ink/40" />
              </div>
            )}

            {step === 'company' && !onboardingFormLoading && onboardingForm && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-semibold mb-1">{t('company.title')}</h1>
                  <p className="text-sm text-ink/40">{t('company.subtitle')}</p>
                </div>
                <DynamicForm
                  schema={onboardingForm.schema}
                  initialData={initialData}
                  category={onboardingForm.category}
                  requireConsent={onboardingForm.requireConsent}
                  consentTermsText={onboardingForm.consentTermsText}
                  disableAiScoring
                  onSubmit={async (responseJson, status) => {
                    const extracted = extractCompanyFieldsFromResponse(onboardingForm.schema, responseJson)
                    if (status === 'draft') {
                      await saveDraftMutation.mutateAsync(extracted)
                    } else {
                      await lockMutation.mutateAsync(extracted)
                    }
                  }}
                />
              </div>
            )}

            {step === 'company' && !onboardingFormLoading && !onboardingForm && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-semibold mb-1">{t('company.title')}</h1>
                  <p className="text-sm text-ink/40">{t('company.subtitle')}</p>
                </div>

                <SectionCard title={t('company.businessIdentity.title')} subtitle={t('company.businessIdentity.subtitle')}>
                  <div className="grid grid-cols-2 gap-4">
                    <FieldBlock label={t('company.businessIdentity.nameLabel')} required>
                      <Input
                        value={draft.name}
                        onChange={(e) => updateDraft('name', e.target.value)}
                        className={cn(draftErrors.name && 'border-destructive focus-visible:border-destructive')}
                      />
                    </FieldBlock>
                    <FieldBlock label={t('company.businessIdentity.uenLabel')}>
                      <Input value={draft.uen} onChange={(e) => updateDraft('uen', e.target.value)} />
                    </FieldBlock>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FieldBlock label={t('company.businessIdentity.industryLabel')} required>
                      <Select value={draft.industry} onValueChange={(v) => v && updateDraft('industry', v)}>
                        <SelectTrigger className={cn(draftErrors.industry && 'border-destructive focus-visible:border-destructive')}>
                          <SelectValue placeholder={t('company.businessIdentity.industryPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {INDUSTRY_OPTIONS.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {t(`company.industries.${opt}`, opt)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FieldBlock>
                    <FieldBlock label={t('company.businessIdentity.companySizeLabel')} required>
                      <RadioGroup value={draft.companySize} onValueChange={(v) => updateDraft('companySize', v)} className="flex items-center gap-4 mt-2">
                        {COMPANY_SIZE_OPTIONS.map((opt) => (
                          <label key={opt.value} className="flex items-center gap-1.5 text-sm cursor-pointer font-normal">
                            <RadioGroupItem value={opt.value} />
                            {t(`company.sizes.${opt.value}`, opt.label)}
                          </label>
                        ))}
                      </RadioGroup>
                    </FieldBlock>
                  </div>
                </SectionCard>

                <SectionCard title={t('company.primaryContact.title')} subtitle={t('company.primaryContact.subtitle')}>
                  <div className="grid grid-cols-2 gap-4">
                    <FieldBlock label={t('company.primaryContact.fullNameLabel')}>
                      <Input value={user?.name ?? ''} readOnly className="bg-muted text-muted-foreground" />
                    </FieldBlock>
                    <FieldBlock label={t('company.primaryContact.roleLabel')} required>
                      <Select value={draft.roleInBusiness} onValueChange={(v) => v && updateDraft('roleInBusiness', v)}>
                        <SelectTrigger className={cn(draftErrors.roleInBusiness && 'border-destructive focus-visible:border-destructive')}>
                          <SelectValue placeholder={t('company.primaryContact.rolePlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {t(`company.roles.${opt}`, opt)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FieldBlock>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FieldBlock label={t('company.primaryContact.emailLabel')}>
                      <Input value={user?.email ?? ''} readOnly className="bg-muted text-muted-foreground" />
                    </FieldBlock>
                    <FieldBlock label={t('company.primaryContact.mobileLabel')} required>
                      <Input
                        value={draft.mobileNumber}
                        onChange={(e) => updateDraft('mobileNumber', e.target.value)}
                        className={cn(draftErrors.mobileNumber && 'border-destructive focus-visible:border-destructive')}
                      />
                    </FieldBlock>
                  </div>
                  <div className="space-y-2.5 pt-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={draft.consentWhatsapp} onCheckedChange={(v) => updateDraft('consentWhatsapp', !!v)} />
                      {t('company.primaryContact.consentWhatsapp')}
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={draft.consentEmail} onCheckedChange={(v) => updateDraft('consentEmail', !!v)} />
                      {t('company.primaryContact.consentEmail')}
                    </label>
                  </div>
                </SectionCard>

                <SectionCard title={t('company.legal.title')} subtitle={t('company.legal.subtitle')}>
                  <div className="space-y-4">
                    <AckRow
                      checked={draft.platformScopeAck}
                      onCheckedChange={(v) => updateDraft('platformScopeAck', v)}
                      error={draftErrors.platformScopeAck}
                      title={t('company.legal.platformScopeTitle')}
                      description={t('company.legal.platformScopeDescription')}
                    />
                    <AckRow
                      checked={draft.participationAuthorityAck}
                      onCheckedChange={(v) => updateDraft('participationAuthorityAck', v)}
                      error={draftErrors.participationAuthorityAck}
                      title={t('company.legal.participationAuthorityTitle')}
                      description={t('company.legal.participationAuthorityDescription')}
                    />
                  </div>
                </SectionCard>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" disabled={saveDraftMutation.isPending} onClick={() => saveDraftMutation.mutate(undefined)}>
                    {t('company.saveDraftButton')}
                  </Button>
                  <Button disabled={lockMutation.isPending} onClick={handleLockClick}>
                    {t('company.lockButton')}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="surface-card p-6 space-y-4">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function FieldBlock({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label required={required}>{label}</Label>
      {children}
    </div>
  )
}

function AckRow({
  checked,
  onCheckedChange,
  error,
  title,
  description,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  error?: boolean
  title: string
  description: string
}) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer">
      <Checkbox checked={checked} onCheckedChange={(c) => onCheckedChange(!!c)} aria-invalid={error} className="mt-0.5" />
      <span>
        <span className="block text-sm font-medium">
          {title} <span className="text-destructive">*</span>
        </span>
        <span className="block text-xs text-muted-foreground mt-0.5">{description}</span>
      </span>
    </label>
  )
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-ink/60">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function GlassInput({ className, error, ...props }: React.ComponentProps<'input'> & { error?: boolean }) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-ink shadow-xs',
        'placeholder:text-ink/25 outline-none transition-all',
        'focus:border-glass-border focus:bg-glass-2',
        error && 'border-destructive focus:border-destructive',
        className,
      )}
      {...props}
    />
  )
}

function GlassPasswordInput({ className, error, ...props }: React.ComponentProps<'input'> & { error?: boolean }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <GlassInput type={visible ? 'text' : 'password'} className={cn('pr-9', className)} error={error} {...props} />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink/70"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

function PrimaryButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full h-11 rounded-xl bg-ink text-page font-semibold text-sm shadow-md hover:bg-ink/90 hover:shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  )
}
