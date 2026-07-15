import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Loader2, Building2, ChevronRight, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'

type Step = 'org' | 'account' | 'verify' | 'done'

const STEPS: { id: Step; labelKey: string }[] = [
  { id: 'org', labelKey: 'stepIndicator.organization' },
  { id: 'account', labelKey: 'stepIndicator.account' },
  { id: 'verify', labelKey: 'stepIndicator.verify' },
  { id: 'done', labelKey: 'stepIndicator.done' },
]

const ORG_TYPES: { labelKey: string; value: string }[] = [
  { labelKey: 'orgTypes.university', value: 'university' },
  { labelKey: 'orgTypes.corporate', value: 'corporate' },
  { labelKey: 'orgTypes.vcBacked', value: 'vc_backed' },
  { labelKey: 'orgTypes.government', value: 'government' },
  { labelKey: 'orgTypes.independent', value: 'independent' },
  { labelKey: 'orgTypes.other', value: 'other' },
]

export default function GetStartedPage() {
  const navigate = useNavigate()
  const { t } = useTranslation('getStarted')
  const { register, verifyEmail, login } = useAuth()

  const [step, setStep] = useState<Step>('org')
  const [loading, setLoading] = useState(false)

  // Org fields
  const [orgName, setOrgName] = useState('')
  const [orgType, setOrgType] = useState('')
  const [orgWebsite, setOrgWebsite] = useState('')

  // Account fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Verify
  const [code, setCode] = useState('')

  const stepIndex = STEPS.findIndex(s => s.id === step)

  async function handleOrgNext(e: React.FormEvent) {
    e.preventDefault()
    if (!orgType) { toast.error(t('org.typeRequiredError')); return }
    setStep('account')
  }

  async function handleAccountNext(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const name = `${firstName} ${lastName}`.trim()
      await register(email, password, name, {
        organizationName: orgName,
        organizationType: orgType,
        organizationWebsite: orgWebsite || undefined,
      })
      setStep('verify')
      toast.success(t('account.verificationSent'))
    } catch (err: unknown) {
      toast.error(apiError(err, t('account.registrationFailed')))
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await verifyEmail(email, code)
      await login(email, password)
      setStep('done')
    } catch (err: unknown) {
      toast.error(apiError(err, t('verify.verificationFailed')))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-page text-ink overflow-hidden">
      {/* Aurora */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-[oklch(0.55_0.22_265)] opacity-[0.18] blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[500px] w-[450px] rounded-full bg-[oklch(0.58_0.22_30)] opacity-[0.12] blur-[130px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 border-b border-glass-border bg-page/80 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-glass-2 border border-glass-border flex items-center justify-center font-bold text-sm">A</div>
            <span className="font-semibold tracking-tight">AccelerateOS</span>
          </a>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button onClick={() => navigate('/login')} className="text-sm text-ink/40 hover:text-ink transition-colors">
              {t('nav.signInPrompt')}
            </button>
          </div>
        </div>
      </nav>

      <div className="relative z-10 mx-auto max-w-lg px-6 py-16">

        {/* Step indicator */}
        {step !== 'done' && (
          <div className="flex items-center gap-0 mb-12">
            {STEPS.filter(s => s.id !== 'done').map((s, i) => {
              const idx = STEPS.filter(s => s.id !== 'done').findIndex(x => x.id === s.id)
              const currentIdx = STEPS.filter(s => s.id !== 'done').findIndex(x => x.id === step)
              const done = idx < currentIdx
              const active = idx === currentIdx
              return (
                <div key={s.id} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={cn(
                      'h-8 w-8 rounded-full border-2 flex items-center justify-center text-xs font-semibold transition-all',
                      done ? 'border-glass-border bg-glass-2 text-ink/60' :
                      active ? 'border-ink bg-ink text-page' :
                      'border-glass-border text-ink/25'
                    )}>
                      {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                    </div>
                    <span className={cn(
                      'text-[10px] whitespace-nowrap',
                      active ? 'text-ink/70' : 'text-ink/25'
                    )}>{t(s.labelKey)}</span>
                  </div>
                  {i < 2 && <div className={cn('flex-1 h-px mx-3 mb-5', done ? 'bg-ink/20' : 'bg-glass-2')} />}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Step 1: Organization ── */}
        {step === 'org' && (
          <form onSubmit={handleOrgNext} className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-ink mb-1">{t('org.title')}</h1>
              <p className="text-sm text-ink/40">{t('org.subtitle')}</p>
            </div>

            <div className="space-y-4">
              <FormField label={t('org.nameLabel')}>
                <GlassInput
                  placeholder={t('org.namePlaceholder')}
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  required
                  autoFocus
                />
              </FormField>

              <FormField label={t('org.typeLabel')}>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {ORG_TYPES.map(type => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setOrgType(type.value)}
                      className={cn(
                        'rounded-lg border px-3 py-2.5 text-left text-xs transition-all',
                        orgType === type.value
                          ? 'border-glass-border bg-glass-2 text-ink'
                          : 'border-glass-border bg-glass text-ink/40 hover:bg-glass-2 hover:text-ink/70',
                      )}
                    >
                      {t(type.labelKey)}
                    </button>
                  ))}
                </div>
              </FormField>

              <FormField label={t('org.websiteLabel')}>
                <GlassInput
                  type="url"
                  placeholder={t('org.websitePlaceholder')}
                  value={orgWebsite}
                  onChange={e => setOrgWebsite(e.target.value)}
                />
              </FormField>
            </div>

            <PrimaryButton loading={false}>
              {t('org.continue')} <ChevronRight className="h-4 w-4" />
            </PrimaryButton>
          </form>
        )}

        {/* ── Step 2: Create account ── */}
        {step === 'account' && (
          <form onSubmit={handleAccountNext} className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="h-6 w-6 rounded-md bg-glass border border-glass-border flex items-center justify-center">
                  <Building2 className="h-3.5 w-3.5 text-ink/40" />
                </div>
                <span className="text-xs text-ink/40">{orgName}</span>
              </div>
              <h1 className="text-2xl font-semibold text-ink mb-1">{t('account.title')}</h1>
              <p className="text-sm text-ink/40">{t('account.subtitle')}</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField label={t('account.firstNameLabel')}>
                  <GlassInput placeholder={t('account.firstNamePlaceholder')} value={firstName} onChange={e => setFirstName(e.target.value)} required autoFocus />
                </FormField>
                <FormField label={t('account.lastNameLabel')}>
                  <GlassInput placeholder={t('account.lastNamePlaceholder')} value={lastName} onChange={e => setLastName(e.target.value)} required />
                </FormField>
              </div>
              <FormField label={t('account.emailLabel')}>
                <GlassInput type="email" placeholder={t('account.emailPlaceholder')} value={email} onChange={e => setEmail(e.target.value)} required />
              </FormField>
              <FormField label={t('account.passwordLabel')}>
                <GlassInput type="password" placeholder={t('account.passwordPlaceholder')} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
              </FormField>
            </div>

            <PrimaryButton loading={loading}>
              {t('account.createAccount')} <ChevronRight className="h-4 w-4" />
            </PrimaryButton>

            <button type="button" onClick={() => setStep('org')} className="w-full text-center text-xs text-ink/30 hover:text-ink/60 transition-colors">
              {t('account.back')}
            </button>
          </form>
        )}

        {/* ── Step 3: Verify email ── */}
        {step === 'verify' && (
          <form onSubmit={handleVerify} className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-ink mb-1">{t('verify.title')}</h1>
              <p className="text-sm text-ink/40">
                {t('verify.subtitlePrefix')} <span className="text-ink/70 font-medium">{email}</span>
              </p>
            </div>

            <FormField label={t('verify.codeLabel')}>
              <GlassInput
                placeholder={t('verify.codePlaceholder')}
                value={code}
                onChange={e => setCode(e.target.value)}
                required
                autoFocus
                inputMode="numeric"
                maxLength={6}
                className="text-center text-2xl tracking-[0.4em] font-mono"
              />
            </FormField>

            <PrimaryButton loading={loading}>{t('verify.verifyAndContinue')}</PrimaryButton>

            <button type="button" onClick={() => setStep('account')} className="w-full text-center text-xs text-ink/30 hover:text-ink/60 transition-colors">
              {t('verify.back')}
            </button>
          </form>
        )}

        {/* ── Step 4: Done ── */}
        {step === 'done' && (
          <div className="text-center space-y-6">
            <div className="inline-flex h-20 w-20 rounded-full bg-glass border border-glass-border items-center justify-center mx-auto">
              <CheckCircle2 className="h-10 w-10 text-green-400" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-ink mb-2">{t('done.title')}</h1>
              <p className="text-sm text-ink/40">
                {t('done.subtitlePrefix', { firstName })} <span className="text-ink/70 font-medium">{orgName}</span> {t('done.subtitleSuffix')}
              </p>
            </div>

            <div className="rounded-xl border border-glass-border bg-glass p-4 text-left space-y-2">
              {(t('done.checklistItems', { returnObjects: true }) as string[]).map((item, i) => (
                <div key={item} className="flex items-center gap-3 text-sm text-ink/50">
                  <div className="h-5 w-5 rounded-full border border-glass-border flex items-center justify-center text-[10px] text-ink/30">{i + 1}</div>
                  {item}
                </div>
              ))}
            </div>

            <button
              onClick={() => navigate('/app')}
              className="w-full h-11 rounded-xl bg-ink text-page font-semibold text-sm hover:bg-ink/90 transition-colors flex items-center justify-center gap-2"
            >
              {t('done.goToDashboard')}
            </button>
          </div>
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

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error
    ?? (err instanceof Error ? err.message : fallback)
}
