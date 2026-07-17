import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Loader2, Building2, ChevronRight, CheckCircle2, Check, CreditCard } from 'lucide-react'
import { useAuth, getStoredTokens } from '@/context/auth-context'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { tenantUrl } from '@/lib/host'
import { encodeHandoff } from '@/lib/session-handoff'
import type { AuthTokens, AuthUser } from '@/types/auth'
import type { SelfServePlan, CouponValidationResult, CheckoutSessionResult, SubscriptionConfirmation } from '@/types/billing'
import { ThemeToggle } from '@/components/theme-toggle'
import { LanguageSwitcher } from '@/components/language-switcher'

type Step = 'org' | 'account' | 'verify' | 'payment' | 'done'

const STEPS: { id: Step; labelKey: string }[] = [
  { id: 'org', labelKey: 'stepIndicator.organization' },
  { id: 'account', labelKey: 'stepIndicator.account' },
  { id: 'verify', labelKey: 'stepIndicator.verify' },
  { id: 'payment', labelKey: 'stepIndicator.payment' },
  { id: 'done', labelKey: 'stepIndicator.done' },
]

const SIGNUP_CONTEXT_KEY = 'aos_signup_context'

function formatCents(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error
    ?? (err instanceof Error ? err.message : fallback)
}

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
  const { user, register, verifyEmail, login } = useAuth()

  const returningFromStripe = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('checkout')

  const [step, setStep] = useState<Step>(returningFromStripe ? 'payment' : 'org')
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
  const [tenantSlug, setTenantSlug] = useState<string | null>(null)
  const [sessionUser, setSessionUser] = useState<AuthUser | null>(null)
  const [sessionTokens, setSessionTokens] = useState<AuthTokens | null>(null)

  // Payment
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null)
  const [couponCode, setCouponCode] = useState('')
  const [couponResult, setCouponResult] = useState<CouponValidationResult | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [confirmingPayment, setConfirmingPayment] = useState(returningFromStripe)

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['self-serve-plans'],
    queryFn: async () => (await api.get<SelfServePlan[]>('/api/plans/active')).data,
    enabled: step === 'payment',
  })
  const selectedPlan = plans?.find(p => p.id === selectedPlanId) ?? null

  // Recover firstName/orgName that a full-page redirect to Stripe checkout wipes from local state.
  useEffect(() => {
    if (!returningFromStripe) return
    try {
      const saved = JSON.parse(sessionStorage.getItem(SIGNUP_CONTEXT_KEY) ?? 'null')
      if (saved?.firstName) setFirstName(saved.firstName)
      if (saved?.orgName) setOrgName(saved.orgName)
    } catch { /* ignore malformed storage */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Once auth is restored from localStorage after the Stripe round-trip, resolve the outcome.
  useEffect(() => {
    if (!returningFromStripe || !user) return

    setTenantSlug(user.tenantSlug)
    setSessionUser(user)
    setSessionTokens(getStoredTokens())

    const params = new URLSearchParams(window.location.search)
    const outcome = params.get('checkout')
    const subscriptionId = params.get('subscriptionId')
    window.history.replaceState(null, '', window.location.pathname)

    if (outcome === 'success' && subscriptionId) {
      api.get<SubscriptionConfirmation>(`/api/tenants/me/subscriptions/${subscriptionId}`)
        .then(() => {
          sessionStorage.removeItem(SIGNUP_CONTEXT_KEY)
          setStep('done')
        })
        .catch(() => toast.error(t('payment.confirmFailed')))
        .finally(() => setConfirmingPayment(false))
    } else {
      if (outcome === 'cancelled') toast.info(t('payment.checkoutCancelled'))
      setConfirmingPayment(false)
      setStep('payment')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const couponMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post<CouponValidationResult>('/api/coupons/validate', {
          code: couponCode,
          appliesTo: 'purchase',
          grossAmountCents: selectedPlan?.priceMonthlyCents ?? 0,
        })
      ).data,
    onSuccess: (data) => {
      setCouponResult(data)
      setCouponError(null)
    },
    onError: (err) => {
      setCouponResult(null)
      setCouponError(apiError(err, t('payment.couponInvalid')))
    },
  })

  const checkoutMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post<CheckoutSessionResult>('/api/tenants/me/subscriptions/checkout', {
          planId: selectedPlanId,
          couponCode: couponResult ? couponCode : undefined,
        })
      ).data,
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        sessionStorage.setItem(SIGNUP_CONTEXT_KEY, JSON.stringify({ firstName, orgName }))
        window.location.href = data.checkoutUrl
      } else {
        toast.error(t('payment.checkoutFailed'))
      }
    },
    onError: (err) => toast.error(apiError(err, t('payment.checkoutFailed'))),
  })

  function handleSelectPlan(planId: number) {
    setSelectedPlanId(planId)
    setCouponCode('')
    setCouponResult(null)
    setCouponError(null)
  }

  function handlePay() {
    if (!selectedPlanId) return
    checkoutMutation.mutate()
  }

  // Nothing to sell yet (super admin hasn't published a billable plan) — don't strand the user.
  useEffect(() => {
    if (step === 'payment' && !plansLoading && plans && plans.length === 0 && !confirmingPayment) {
      toast.info(t('payment.noPlansAvailable'))
      setStep('done')
    }
  }, [step, plansLoading, plans, confirmingPayment, t])

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
      const { user: loggedInUser, tokens } = await login(email, password)
      setTenantSlug(loggedInUser.tenantSlug)
      setSessionUser(loggedInUser)
      setSessionTokens(tokens)
      setStep('payment')
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
            <LanguageSwitcher />
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
                  {i < STEPS.length - 2 && <div className={cn('flex-1 h-px mx-3 mb-5', done ? 'bg-ink/20' : 'bg-glass-2')} />}
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

        {/* ── Step 4: Payment ── */}
        {step === 'payment' && (
          confirmingPayment ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-ink/40" />
              <p className="text-sm text-ink/40">{t('payment.confirming')}</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-semibold text-ink mb-1">{t('payment.title')}</h1>
                <p className="text-sm text-ink/40">{t('payment.subtitle')}</p>
              </div>

              {plansLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-ink/40" />
                </div>
              ) : (
                <FormField label={t('payment.planLabel')}>
                  <select
                    value={selectedPlanId ?? ''}
                    onChange={e => handleSelectPlan(Number(e.target.value))}
                    className={cn(
                      'h-10 w-full rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-ink',
                      'outline-none transition-all focus:border-glass-border focus:bg-glass-2',
                    )}
                  >
                    <option value="" disabled>{t('payment.planPlaceholder')}</option>
                    {(plans ?? []).map(plan => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} — {formatCents(plan.priceMonthlyCents)}{t('payment.perMonth')}
                        {!plan.onlineBillingEnabled ? ` (${t('payment.contactRequired')})` : ''}
                      </option>
                    ))}
                  </select>
                </FormField>
              )}

              {selectedPlan && !selectedPlan.onlineBillingEnabled && (
                <p className="text-xs text-ink/40 rounded-lg border border-glass-border bg-glass p-3">
                  {t('payment.contactRequiredMessage')}
                </p>
              )}

              {selectedPlan && selectedPlan.onlineBillingEnabled && (
                <div className="space-y-3 rounded-xl border border-glass-border bg-glass p-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-ink/50">{t('payment.couponLabel')}</label>
                    <div className="flex gap-2">
                      <GlassInput
                        value={couponCode}
                        placeholder={t('payment.couponPlaceholder')}
                        className="font-mono text-sm h-9"
                        disabled={!!couponResult}
                        onChange={e => {
                          setCouponCode(e.target.value.toUpperCase())
                          setCouponResult(null)
                          setCouponError(null)
                        }}
                      />
                      <button
                        type="button"
                        disabled={!couponResult && (!couponCode || couponMutation.isPending)}
                        onClick={() => {
                          if (couponResult) {
                            setCouponResult(null)
                            setCouponCode('')
                          } else {
                            couponMutation.mutate()
                          }
                        }}
                        className={cn(
                          'shrink-0 h-9 px-3 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5',
                          couponResult
                            ? 'border-glass-border bg-glass-2 text-ink'
                            : 'border-glass-border bg-glass text-ink/60 hover:bg-glass-2 disabled:opacity-50',
                        )}
                      >
                        {couponResult ? (<><Check className="h-3.5 w-3.5" /> {t('payment.couponAppliedButton')}</>) : t('payment.couponApply')}
                      </button>
                    </div>
                    {couponResult && (
                      <p className="text-xs text-green-500">
                        {t('payment.couponApplied', { amount: formatCents(couponResult.discountCents) })}
                      </p>
                    )}
                    {couponError && <p className="text-xs text-destructive">{couponError}</p>}
                  </div>

                  <div className="flex items-center justify-between border-t border-glass-border pt-3">
                    <span className="text-sm font-medium text-ink/60">{t('payment.totalLabel')}</span>
                    <span className="text-base font-bold text-ink">
                      {formatCents(Math.max(0, selectedPlan.priceMonthlyCents - (couponResult?.discountCents ?? 0)))}
                    </span>
                  </div>
                </div>
              )}

              <PrimaryButton
                loading={checkoutMutation.isPending}
                onClick={handlePay}
                disabled={!selectedPlan || !selectedPlan.onlineBillingEnabled}
              >
                <CreditCard className="h-4 w-4" /> {t('payment.payButton')}
              </PrimaryButton>
            </div>
          )
        )}

        {/* ── Step 5: Done ── */}
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
              onClick={() => {
                if (tenantSlug && sessionUser && sessionTokens) {
                  const baseDomain = import.meta.env.VITE_BASE_DOMAIN
                  window.location.href = tenantUrl(tenantSlug, baseDomain) + encodeHandoff(sessionTokens, sessionUser)
                } else {
                  navigate('/login')
                }
              }}
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

function PrimaryButton({
  loading,
  disabled,
  onClick,
  children,
}: {
  loading: boolean
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type={onClick ? 'button' : 'submit'}
      onClick={onClick}
      disabled={loading || disabled}
      className="w-full h-11 rounded-xl bg-ink text-page font-semibold text-sm hover:bg-ink/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  )
}
