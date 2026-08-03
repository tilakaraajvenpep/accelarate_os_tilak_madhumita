import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import type { LoginResponse } from '@/types/auth'
import type { InviteDetails } from '@/types/company'
import { ThemeToggle } from '@/components/theme-toggle'
import { LanguageSwitcher } from '@/components/language-switcher'
import { DynamicForm } from '@/components/dynamic-form'
import type { FormQuestion } from '@/types/forms'

type Step = 'password' | 'specialization' | 'done'

interface MentorOnboardingForm {
  mappingId: number
  templateId: number
  title: string
  schema: FormQuestion[]
  category: string
  requireConsent: boolean
  consentTermsText: string | null
}

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error
    ?? (err instanceof Error ? err.message : fallback)
}

export default function AcceptMentorInvitePage() {
  const navigate = useNavigate()
  const { t } = useTranslation('acceptMentorInvite')
  const { adoptSession } = useAuth()
  const token = new URLSearchParams(window.location.search).get('token') ?? ''

  const [step, setStep] = useState<Step>('password')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [specialization, setSpecialization] = useState('')

  const { data: invite, isLoading: inviteLoading, isError: inviteInvalid } = useQuery({
    queryKey: ['mentor-invite-details', token],
    queryFn: async () => (await api.get<InviteDetails>(`/api/mentor-invites/${token}`)).data,
    enabled: !!token,
    retry: false,
  })

  useEffect(() => {
    if (invite) setStep('password')
  }, [invite])

  const acceptMutation = useMutation({
    mutationFn: async () => (await api.post<LoginResponse>(`/api/mentor-invites/${token}/accept`, { password })).data,
    onSuccess: (data) => {
      const { user, ...tokens } = data
      adoptSession(tokens, user)
      setStep('specialization')
    },
    onError: (err) => toast.error(apiError(err, t('password.failed'))),
  })

  // If the tenant has a custom "mentor onboarding" form mapped (Setup > Forms > Mappings),
  // it replaces the hardcoded specialization field below.
  const { data: onboardingForm, isLoading: onboardingFormLoading } = useQuery({
    queryKey: ['mentor-onboarding-form'],
    queryFn: async () => (await api.get<MentorOnboardingForm | null>('/api/tenants/me/mentor-onboarding-form')).data,
    enabled: step === 'specialization',
  })

  const specializationMutation = useMutation({
    mutationFn: async () => (await api.patch('/api/tenants/me/mentor-profile', { specialization })).data,
    onSuccess: () => setStep('done'),
    onError: (err) => toast.error(apiError(err, t('specialization.failed'))),
  })

  const onboardingResponseMutation = useMutation({
    mutationFn: async (responseJson: Record<string, unknown>) =>
      (await api.patch('/api/tenants/me/mentor-profile/onboarding-response', { templateId: onboardingForm!.templateId, responseJson })).data,
    onSuccess: () => setStep('done'),
    onError: (err) => toast.error(apiError(err, t('specialization.failed'))),
  })

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password) { toast.error('Password is required'); return }
    if (password.length < 8) { toast.error(t('password.tooShort')); return }
    if (password !== confirmPassword) { toast.error(t('password.mismatch')); return }
    acceptMutation.mutate()
  }

  function handleSpecializationSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!specialization.trim()) {
      toast.error('Specialization is required')
      return
    }
    specializationMutation.mutate()
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

      <div className="relative z-10 mx-auto max-w-lg px-6 py-16">
        {!token || inviteInvalid ? (
          <div className="text-center space-y-4 py-16">
            <div className="inline-flex h-16 w-16 rounded-full bg-glass border border-glass-border shadow-sm items-center justify-center mx-auto">
              <AlertCircle className="h-7 w-7 text-destructive" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">{t('invalid.title')}</h1>
              <p className="text-sm text-ink/40 mt-1">{t('invalid.subtitle')}</p>
            </div>
          </div>
        ) : inviteLoading ? (
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
                  <FormField label={t('password.passwordLabel')}>
                    <GlassPasswordInput placeholder={t('password.passwordPlaceholder')} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoFocus />
                  </FormField>
                  <FormField label={t('password.confirmLabel')}>
                    <GlassPasswordInput placeholder={t('password.confirmPlaceholder')} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} />
                  </FormField>
                </div>

                <PrimaryButton loading={acceptMutation.isPending}>{t('password.continueButton')}</PrimaryButton>
              </form>
            )}

            {step === 'specialization' && onboardingFormLoading && (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-ink/40" />
              </div>
            )}

            {step === 'specialization' && !onboardingFormLoading && onboardingForm && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-semibold mb-1">{onboardingForm.title}</h1>
                  <p className="text-sm text-ink/40">{t('specialization.subtitle')}</p>
                </div>
                <DynamicForm
                  schema={onboardingForm.schema}
                  category={onboardingForm.category}
                  requireConsent={onboardingForm.requireConsent}
                  consentTermsText={onboardingForm.consentTermsText}
                  disableAiScoring
                  onSubmit={async (responseJson, status) => {
                    if (status !== 'submitted') {
                      toast.info(t('specialization.draftNotNeeded'))
                      return
                    }
                    await onboardingResponseMutation.mutateAsync(responseJson)
                  }}
                />
              </div>
            )}

            {step === 'specialization' && !onboardingFormLoading && !onboardingForm && (
              <form noValidate onSubmit={handleSpecializationSubmit} className="space-y-6 rounded-2xl border border-glass-border bg-glass backdrop-blur-xl shadow-xl p-8 sm:p-10">
                <div>
                  <h1 className="text-2xl font-semibold mb-1">{t('specialization.title')}</h1>
                  <p className="text-sm text-ink/40">{t('specialization.subtitle')}</p>
                </div>

                <FormField label={t('specialization.label')}>
                  <GlassInput placeholder={t('specialization.placeholder')} value={specialization} onChange={(e) => setSpecialization(e.target.value)} required autoFocus />
                </FormField>

                <PrimaryButton loading={specializationMutation.isPending}>{t('specialization.finishButton')}</PrimaryButton>
              </form>
            )}

            {step === 'done' && (
              <div className="text-center space-y-6 rounded-2xl border border-glass-border bg-glass backdrop-blur-xl shadow-xl p-8 sm:p-10">
                <div className="inline-flex h-20 w-20 rounded-full bg-glass border border-glass-border shadow-md items-center justify-center mx-auto">
                  <CheckCircle2 className="h-10 w-10 text-ink" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold mb-2">{t('done.title')}</h1>
                  <p className="text-sm text-ink/40">{t('done.subtitle')}</p>
                </div>
                <button
                  onClick={() => navigate('/')}
                  className="w-full h-11 rounded-xl bg-ink text-page font-semibold text-sm shadow-md hover:bg-ink/90 hover:shadow-lg transition-all"
                >
                  {t('done.goToDashboard')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-ink/60">{label}</label>
      {children}
    </div>
  )
}

function GlassInput({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-ink shadow-xs',
        'placeholder:text-ink/25 outline-none transition-all',
        'focus:border-glass-border focus:bg-glass-2',
        className,
      )}
      {...props}
    />
  )
}

function GlassPasswordInput({ className, ...props }: React.ComponentProps<'input'>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <GlassInput type={visible ? 'text' : 'password'} className={cn('pr-9', className)} {...props} />
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
