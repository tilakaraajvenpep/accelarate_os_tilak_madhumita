import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { useAuth, getStoredTokens } from '@/context/auth-context'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import type { LoginResponse } from '@/types/auth'
import type { InviteDetails, Company } from '@/types/company'
import { ThemeToggle } from '@/components/theme-toggle'
import { LanguageSwitcher } from '@/components/language-switcher'

type Step = 'password' | 'company' | 'done'

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error
    ?? (err instanceof Error ? err.message : fallback)
}

export default function AcceptInvitePage() {
  const navigate = useNavigate()
  const { t } = useTranslation('acceptInvite')
  const { user, adoptSession } = useAuth()
  const token = new URLSearchParams(window.location.search).get('token') ?? ''

  const [step, setStep] = useState<Step>('password')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [companyName, setCompanyName] = useState('')
  const [location, setLocation] = useState('')
  const [establishedYear, setEstablishedYear] = useState('')
  const [founderName, setFounderName] = useState('')

  const { data: invite, isLoading: inviteLoading, isError: inviteInvalid } = useQuery({
    queryKey: ['invite-details', token],
    queryFn: async () => (await api.get<InviteDetails>(`/api/invites/${token}`)).data,
    enabled: !!token,
    retry: false,
  })

  useEffect(() => {
    if (invite?.name) setFounderName(invite.name)
  }, [invite])

  const acceptMutation = useMutation({
    mutationFn: async () => (await api.post<LoginResponse>(`/api/invites/${token}/accept`, { password })).data,
    onSuccess: (data) => {
      const { user, ...tokens } = data
      adoptSession(tokens, user)
      setStep('company')
    },
    onError: (err) => toast.error(apiError(err, t('password.failed'))),
  })

  const companyMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post<Company>('/api/tenants/me/companies', {
          name: companyName,
          location: location || null,
          establishedYear: establishedYear ? Number(establishedYear) : null,
          founderName,
        })
      ).data,
    onSuccess: () => {
      // The invite's placeholder name is stale now — refresh the cached session
      // with the real name the founder just entered, so the dashboard greeting
      // is correct immediately without requiring them to log in again.
      const tokens = getStoredTokens()
      if (user && tokens) adoptSession(tokens, { ...user, name: founderName })
      setStep('done')
    },
    onError: (err) => toast.error(apiError(err, t('company.failed'))),
  })

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { toast.error(t('password.tooShort')); return }
    if (password !== confirmPassword) { toast.error(t('password.mismatch')); return }
    acceptMutation.mutate()
  }

  function handleCompanySubmit(e: React.FormEvent) {
    e.preventDefault()
    companyMutation.mutate()
  }

  return (
    <div className="relative min-h-screen bg-page text-ink overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-[oklch(0.55_0.22_265)] opacity-[0.18] blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[500px] w-[450px] rounded-full bg-[oklch(0.58_0.22_30)] opacity-[0.12] blur-[130px]" />
      </div>

      <nav className="relative z-10 border-b border-glass-border bg-page/80 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-glass-2 border border-glass-border flex items-center justify-center font-bold text-sm">A</div>
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
          <div className="text-center space-y-3 py-16">
            <h1 className="text-xl font-semibold">{t('invalid.title')}</h1>
            <p className="text-sm text-ink/40">{t('invalid.subtitle')}</p>
          </div>
        ) : inviteLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-ink/40" />
          </div>
        ) : (
          <>
            {step === 'password' && (
              <form onSubmit={handlePasswordSubmit} className="space-y-6">
                <div>
                  <h1 className="text-2xl font-semibold mb-1">{t('password.title')}</h1>
                  <p className="text-sm text-ink/40">
                    {t('password.subtitlePrefix')} <span className="text-ink/70 font-medium">{invite?.email}</span>
                  </p>
                </div>

                <div className="space-y-4">
                  <FormField label={t('password.passwordLabel')}>
                    <GlassInput type="password" placeholder={t('password.passwordPlaceholder')} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoFocus />
                  </FormField>
                  <FormField label={t('password.confirmLabel')}>
                    <GlassInput type="password" placeholder={t('password.confirmPlaceholder')} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} />
                  </FormField>
                </div>

                <PrimaryButton loading={acceptMutation.isPending}>{t('password.continueButton')}</PrimaryButton>
              </form>
            )}

            {step === 'company' && (
              <form onSubmit={handleCompanySubmit} className="space-y-6">
                <div>
                  <h1 className="text-2xl font-semibold mb-1">{t('company.title')}</h1>
                  <p className="text-sm text-ink/40">{t('company.subtitle')}</p>
                </div>

                <div className="space-y-4">
                  <FormField label={t('company.nameLabel')}>
                    <GlassInput placeholder={t('company.namePlaceholder')} value={companyName} onChange={(e) => setCompanyName(e.target.value)} required autoFocus />
                  </FormField>
                  <FormField label={t('company.locationLabel')}>
                    <GlassInput placeholder={t('company.locationPlaceholder')} value={location} onChange={(e) => setLocation(e.target.value)} />
                  </FormField>
                  <FormField label={t('company.establishedYearLabel')}>
                    <GlassInput type="number" placeholder={t('company.establishedYearPlaceholder')} value={establishedYear} onChange={(e) => setEstablishedYear(e.target.value)} min={1800} max={new Date().getFullYear()} />
                  </FormField>
                  <FormField label={t('company.founderNameLabel')}>
                    <GlassInput placeholder={t('company.founderNamePlaceholder')} value={founderName} onChange={(e) => setFounderName(e.target.value)} required />
                    <p className="text-xs font-semibold text-ink/70 mt-1">{t('company.founderNameHelp')}</p>
                  </FormField>
                </div>

                <PrimaryButton loading={companyMutation.isPending}>{t('company.finishButton')}</PrimaryButton>
              </form>
            )}

            {step === 'done' && (
              <div className="text-center space-y-6">
                <div className="inline-flex h-20 w-20 rounded-full bg-glass border border-glass-border items-center justify-center mx-auto">
                  <CheckCircle2 className="h-10 w-10 text-green-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold mb-2">{t('done.title')}</h1>
                  <p className="text-sm text-ink/40">{t('done.subtitle')}</p>
                </div>
                <button
                  onClick={() => navigate('/')}
                  className="w-full h-11 rounded-xl bg-ink text-page font-semibold text-sm hover:bg-ink/90 transition-colors"
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
        'h-10 w-full rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-ink',
        'placeholder:text-ink/25 outline-none transition-all',
        'focus:border-glass-border focus:bg-glass-2',
        className,
      )}
      {...props}
    />
  )
}

function PrimaryButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full h-11 rounded-xl bg-ink text-page font-semibold text-sm hover:bg-ink/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  )
}
