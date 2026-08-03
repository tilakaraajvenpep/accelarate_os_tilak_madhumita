import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Loader2, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { api } from '@/lib/api'
import { cleanErrorMessage } from '@/lib/api-error'
import { classifyHost, adminUrl, tenantUrl } from '@/lib/host'
import { encodeHandoff } from '@/lib/session-handoff'
import { ThemeToggle } from '@/components/theme-toggle'
import { LanguageSwitcher } from '@/components/language-switcher'

type View = 'signin' | 'verify-email' | 'forgot-password' | 'reset-password'

export default function LoginPage() {
  const { t } = useTranslation('login')
  const navigate = useNavigate()
  const { login, verifyEmail } = useAuth()
  const [view, setView] = useState<View>('signin')
  const [loading, setLoading] = useState(false)
  const [pendingEmail] = useState('')

  const [siEmail, setSiEmail] = useState('')
  const [siPassword, setSiPassword] = useState('')
  const [verifyCode, setVerifyCode] = useState('')

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    if (!siEmail.trim()) { toast.error('Email is required'); return }
    if (!siPassword) { toast.error('Password is required'); return }
    setLoading(true)
    try {
      const { user, tokens } = await login(siEmail, siPassword)
      const baseDomain = import.meta.env.VITE_BASE_DOMAIN
      const host = classifyHost(window.location.hostname, baseDomain)
      if (user.role === 'super_admin') {
        if (host.kind === 'admin') navigate('/')
        else window.location.href = adminUrl(baseDomain) + encodeHandoff(tokens, user)
      } else if (user.tenantSlug) {
        if (host.kind === 'tenant' && host.slug === user.tenantSlug) navigate('/')
        else window.location.href = tenantUrl(user.tenantSlug, baseDomain) + encodeHandoff(tokens, user)
      } else {
        toast.error(t('signin.errorFallback'))
      }
    }
    catch (err) { toast.error(apiError(err, t('signin.errorFallback'))) }
    finally { setLoading(false) }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!verifyCode.trim()) { toast.error('Verification code is required'); return }
    setLoading(true)
    try {
      await verifyEmail(pendingEmail, verifyCode)
      toast.success(t('verifyEmail.successToast'))
      setSiEmail(pendingEmail); setView('signin')
    }
    catch (err) { toast.error(apiError(err, t('verifyEmail.errorFallback'))) }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-page flex flex-col">
      {/* Top bar */}
      <div className="border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-6 h-[60px]">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-lg bg-gradient-accent flex items-center justify-center text-white text-xs font-bold">
            A
          </div>
          <span className="text-sm font-semibold text-foreground">{t('common:brand')}</span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 lg:grid lg:grid-cols-2">
        {/* Form panel */}
        <div className="flex flex-col justify-start pt-16 sm:pt-24 lg:pt-28 pb-12 px-6 lg:px-12 bg-muted/20 border-r border-border">
          <div className="max-w-md w-full mx-auto">
            <div className="bg-card border border-border rounded-xl p-6 sm:p-8 shadow-xs">
              {view === 'signin' && (
                <>
                  <div className="mb-6">
                    <h1 className="text-xl font-bold text-foreground mb-1.5">{t('signin.title')}</h1>
                    <p className="text-sm text-muted-foreground">{t('signin.subtitle')}</p>
                  </div>
                  <form noValidate onSubmit={handleSignIn} className="space-y-4">
                    <InputField
                      id="login-email"
                      label={t('common:email')}
                      type="email"
                      placeholder="you@company.com"
                      value={siEmail}
                      onChange={e => setSiEmail(e.target.value)}
                      required
                      autoFocus
                    />
                    <InputField
                      id="login-password"
                      label={t('signin.passwordLabel')}
                      isPassword
                      placeholder="••••••••"
                      value={siPassword}
                      onChange={e => setSiPassword(e.target.value)}
                      required
                      aside={
                        <button
                          type="button"
                          onClick={() => setView('forgot-password')}
                          className="text-xs font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer"
                        >
                          {t('signin.forgotPasswordLink')}
                        </button>
                      }
                    />
                    <SubmitButton loading={loading}>{t('signin.submitButton')}</SubmitButton>
                    <p className="text-center text-xs text-muted-foreground pt-1">
                      {t('signin.newToPlatform')}{' '}
                      <a
                        href="/get-started"
                        className="text-primary font-medium hover:text-primary/80 transition-colors"
                      >
                        {t('signin.startProgramLink')}
                      </a>
                    </p>
                  </form>
                </>
              )}

              {view === 'verify-email' && (
                <>
                  <button
                    onClick={() => setView('signin')}
                    className="mb-6 flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {t('verifyEmail.backButton')}
                  </button>
                  <div className="mb-6">
                    <h1 className="text-xl font-bold text-foreground mb-1.5">{t('verifyEmail.title')}</h1>
                    <p className="text-sm text-muted-foreground">
                      {t('verifyEmail.subtitlePrefix')}{' '}
                      <span className="text-foreground font-medium">{pendingEmail}</span>
                    </p>
                  </div>
                  <form noValidate onSubmit={handleVerify} className="space-y-4">
                    <input
                      id="verify-code"
                      placeholder="000000"
                      value={verifyCode}
                      onChange={e => setVerifyCode(e.target.value)}
                      required
                      autoFocus
                      inputMode="numeric"
                      maxLength={6}
                      className="h-12 w-full text-center text-2xl tracking-[0.4em] font-mono border border-input bg-background rounded-lg text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:ring-2 focus:ring-ring outline-none transition-all"
                      aria-label="Verification code"
                    />
                    <SubmitButton loading={loading}>{t('verifyEmail.submitButton')}</SubmitButton>
                  </form>
                </>
              )}

              {(view === 'forgot-password' || view === 'reset-password') && (
                <ForgotPasswordFlow
                  initialStep={view === 'reset-password' ? 'reset' : 'request'}
                  onDone={() => setView('signin')}
                  onBack={() => setView('signin')}
                />
              )}
            </div>
          </div>
        </div>

        {/* Brand panel */}
        <div className="hidden lg:flex flex-col justify-center p-16 bg-gradient-accent text-white relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `radial-gradient(circle at 20% 80%, white 0%, transparent 50%), radial-gradient(circle at 80% 20%, white 0%, transparent 50%)`,
            }}
          />
          <div className="relative max-w-md">
            {/* Brand Logo and Name */}
            <div className="flex items-center gap-2.5 mb-5">
              <div className="h-8 w-8 rounded-lg bg-white text-black flex items-center justify-center font-bold text-base shadow-xs">
                A
              </div>
              <span className="text-xl font-bold text-white tracking-tight">Accelerate OS</span>
            </div>

            <p className="text-xs font-bold uppercase tracking-widest text-white/60 mb-5">
              {t('brandPanel.eyebrow')}
            </p>
            <h2 className="text-4xl font-bold leading-[1.15] tracking-tight mb-5">
              {t('brandPanel.headline.line1')}<br />{t('brandPanel.headline.line2')}
            </h2>
            <p className="text-base text-white/70 leading-relaxed mb-10">
              {t('brandPanel.description')}
            </p>

            <div className="space-y-0 bg-white/10 rounded-xl overflow-hidden border border-white/20">
              {[
                { step: '01', title: t('brandPanel.steps.assess.title'), desc: t('brandPanel.steps.assess.desc') },
                { step: '02', title: t('brandPanel.steps.roadmap.title'), desc: t('brandPanel.steps.roadmap.desc') },
                { step: '03', title: t('brandPanel.steps.execute.title'), desc: t('brandPanel.steps.execute.desc') },
                { step: '04', title: t('brandPanel.steps.raise.title'), desc: t('brandPanel.steps.raise.desc') },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex gap-4 px-5 py-4 border-b border-white/15 last:border-b-0">
                  <span className="text-xs font-mono font-bold text-white/40 pt-0.5 w-6 flex-shrink-0">{step}</span>
                  <div>
                    <p className="text-sm font-semibold text-white mb-0.5">{title}</p>
                    <p className="text-xs text-white/60 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────────── */

interface InputFieldProps extends React.ComponentProps<'input'> {
  id: string
  label: string
  isPassword?: boolean
  aside?: React.ReactNode
}

function InputField({ id, label, isPassword, aside, ...props }: InputFieldProps) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-foreground">{label}</label>
        {aside}
      </div>
      <div className="relative">
        <input
          id={id}
          type={isPassword ? (visible ? 'text' : 'password') : (props.type ?? 'text')}
          className="h-10 w-full px-3.5 border border-input bg-background rounded-lg text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-ring"
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setVisible(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  )
}

function SubmitButton({ loading, children }: { loading?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      id="login-submit-btn"
      disabled={loading}
      className="w-full h-10 bg-gradient-accent text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm mt-1"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

function ForgotPasswordFlow({ initialStep = 'request', onDone, onBack }: {
  initialStep?: 'request' | 'reset'; onDone: () => void; onBack: () => void
}) {
  const { t } = useTranslation('login')
  const [step, setStep] = useState<'request' | 'reset'>(initialStep)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      toast.success(t('forgotPassword.successToast')); setStep('reset')
    }
    catch (err) { toast.error(apiError(err, t('forgotPassword.errorFallback'))) }
    finally { setLoading(false) }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { email, code, newPassword })
      toast.success(t('resetPassword.successToast')); onDone()
    }
    catch (err) { toast.error(apiError(err, t('resetPassword.errorFallback'))) }
    finally { setLoading(false) }
  }

  return (
    <>
      <button onClick={onBack} className="mb-6 flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> {t('forgotPassword.backButton')}
      </button>
      {step === 'request' ? (
        <>
          <div className="mb-8">
            <h1 className="text-xl font-bold text-foreground mb-1.5">{t('forgotPassword.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('forgotPassword.subtitle')}</p>
          </div>
          <form noValidate onSubmit={handleRequest} className="space-y-4">
            <InputField id="forgot-email" label={t('common:email')} type="email" placeholder="you@company.com"
              value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            <SubmitButton loading={loading}>{t('forgotPassword.submitButton')}</SubmitButton>
          </form>
        </>
      ) : (
        <>
          <div className="mb-8">
            <h1 className="text-xl font-bold text-foreground mb-1.5">{t('resetPassword.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('resetPassword.subtitle')}</p>
          </div>
          <form noValidate onSubmit={handleReset} className="space-y-4">
            <InputField id="reset-code" label={t('resetPassword.resetCodeLabel')} placeholder="000000"
              value={code} onChange={e => setCode(e.target.value)} required autoFocus inputMode="numeric" />
            <InputField id="reset-password" label={t('resetPassword.newPasswordLabel')} isPassword
              placeholder={t('resetPassword.newPasswordPlaceholder')} value={newPassword}
              onChange={e => setNewPassword(e.target.value)} required minLength={8} />
            <SubmitButton loading={loading}>{t('resetPassword.submitButton')}</SubmitButton>
          </form>
        </>
      )}
    </>
  )
}

function apiError(err: unknown, fallback: string) {
  const msg =
    (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
    (err instanceof Error ? err.message : fallback)
  return cleanErrorMessage(msg, fallback)
}
