import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2, ScanLine, Map, Rocket, TrendingUp, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'

type View = 'signin' | 'verify-email' | 'forgot-password' | 'reset-password'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, verifyEmail } = useAuth()
  const [view, setView] = useState<View>('signin')
  const [loading, setLoading] = useState(false)
  const [pendingEmail, setPendingEmail] = useState('')

  const [siEmail, setSiEmail] = useState('')
  const [siPassword, setSiPassword] = useState('')
  const [verifyCode, setVerifyCode] = useState('')

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    try { await login(siEmail, siPassword); navigate('/app') }
    catch (err) { toast.error(apiError(err, 'Sign in failed')) }
    finally { setLoading(false) }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    try {
      await verifyEmail(pendingEmail, verifyCode)
      toast.success('Email verified! You can now sign in.')
      setSiEmail(pendingEmail); setView('signin')
    }
    catch (err) { toast.error(apiError(err, 'Verification failed')) }
    finally { setLoading(false) }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-page">

      {/* ── Aurora background ──────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-[oklch(0.55_0.22_265)] opacity-[0.18] blur-[140px]" />
        <div className="absolute bottom-0 left-0 h-[400px] w-[500px] rounded-full bg-[oklch(0.50_0.25_310)] opacity-[0.14] blur-[120px]" />
        <div className="absolute top-1/4 right-0 h-[500px] w-[450px] rounded-full bg-[oklch(0.58_0.22_30)] opacity-[0.14] blur-[130px]" />
        <div className="absolute bottom-0 right-1/4 h-[350px] w-[350px] rounded-full bg-[oklch(0.68_0.18_80)] opacity-[0.10] blur-[110px]" />
      </div>

      {/* Theme toggle */}
      <div className="absolute top-5 right-5 z-20">
        <ThemeToggle />
      </div>

      {/* ── Two-column grid ───────────────────────────────── */}
      <div className="relative z-10 min-h-screen lg:grid lg:grid-cols-2">

        {/* ── Left: Form panel ─────────────────────────────── */}
        <div className="flex flex-col justify-center items-center min-h-screen lg:min-h-0 px-6 py-12 lg:px-16 lg:border-r lg:border-glass-border">

          {/* Mobile logo */}
          <a href="/" className="lg:hidden mb-8 flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-glass-2 border border-glass-border flex items-center justify-center text-ink font-bold text-sm">A</div>
            <span className="font-semibold text-ink">AccelerateOS</span>
          </a>

          <div className="w-full max-w-sm">

            {view === 'signin' && (
              <>
                <h1 className="text-2xl font-semibold text-ink mb-1">Login to your account</h1>
                <p className="text-sm text-ink/40 mb-7">Enter your email below to login to your account</p>
              </>
            )}

            {/* ── Sign In ── */}
            {view === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <Field label="Email">
                  <GlassInput type="email" placeholder="m@example.com" value={siEmail} onChange={e => setSiEmail(e.target.value)} required autoFocus />
                </Field>
                <Field label="Password" aside={
                  <button type="button" onClick={() => setView('forgot-password')} className="text-xs text-ink/40 hover:text-ink/70 transition-colors">
                    Forgot your password?
                  </button>
                }>
                  <GlassInput type="password" placeholder="••••••••" value={siPassword} onChange={e => setSiPassword(e.target.value)} required />
                </Field>
                <PrimaryButton loading={loading} className="mt-2">Login</PrimaryButton>
                <p className="text-center text-sm text-ink/40 pt-2">
                  New to AccelerateOS?{' '}
                  <a href="/get-started" className="text-ink/70 underline underline-offset-2 hover:text-ink transition-colors">
                    Start your program →
                  </a>
                </p>
              </form>
            )}

            {/* ── Verify email ── */}
            {view === 'verify-email' && (
              <>
                <button onClick={() => setView('signin')} className="mb-5 text-xs text-ink/40 hover:text-ink/70 transition-colors">← Back</button>
                <h1 className="text-2xl font-semibold text-ink mb-1">Check your email</h1>
                <p className="text-sm text-ink/40 mb-7">
                  We sent a 6-digit code to <span className="text-ink/70 font-medium">{pendingEmail}</span>
                </p>
                <form onSubmit={handleVerify} className="space-y-4">
                  <GlassInput
                    placeholder="000000"
                    value={verifyCode}
                    onChange={e => setVerifyCode(e.target.value)}
                    required autoFocus inputMode="numeric" maxLength={6}
                    className="text-center text-2xl tracking-[0.4em] font-mono"
                  />
                  <PrimaryButton loading={loading}>Verify email</PrimaryButton>
                </form>
              </>
            )}

            {/* ── Forgot / Reset password ── */}
            {(view === 'forgot-password' || view === 'reset-password') && (
              <ForgotPasswordFlow
                initialStep={view === 'reset-password' ? 'reset' : 'request'}
                onDone={() => setView('signin')}
                onBack={() => setView('signin')}
              />
            )}

          </div>
        </div>

        {/* ── Right: Brand panel ───────────────────────────── */}
        <div className="hidden lg:flex flex-col justify-between p-12 bg-glass border-l border-glass-border">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-glass-2 border border-glass-border backdrop-blur-sm flex items-center justify-center text-ink font-bold">
              A
            </div>
            <span className="text-ink font-semibold tracking-tight">AccelerateOS</span>
          </div>

          {/* Center content */}
          <div className="space-y-8">

            {/* Headline */}
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink/30 font-medium">The Entrepreneurial Journey</p>
              <h2 className="text-[2.4rem] font-bold text-ink leading-[1.15]">
                From first idea<br />to funded founder.
              </h2>
              <p className="text-sm text-ink/40 leading-relaxed max-w-xs">
                AccelerateOS gives every founder a structured path, AI-powered insights, and the community to grow from zero to raise-ready — faster than ever before.
              </p>
            </div>

            {/* Journey steps */}
            <div className="space-y-2.5">
              {[
                {
                  icon: ScanLine,
                  step: '01',
                  color: 'oklch(0.65 0.22 265)',
                  title: 'Assess your foundations',
                  desc: 'Get an honest baseline across 8 startup pillars — product, go-to-market, finance, team, legal, and more — in minutes.',
                },
                {
                  icon: Map,
                  step: '02',
                  color: 'oklch(0.65 0.20 200)',
                  title: 'Build your roadmap',
                  desc: 'Receive a tailored action plan. Work through curated milestones with your mentor and cohort peers to close gaps fast.',
                },
                {
                  icon: Rocket,
                  step: '03',
                  color: 'oklch(0.65 0.22 310)',
                  title: 'Execute & stay accountable',
                  desc: 'Weekly check-ins, live dashboards, and peer benchmarks keep you on track. No milestone falls through the cracks.',
                },
                {
                  icon: TrendingUp,
                  step: '04',
                  color: 'oklch(0.70 0.18 145)',
                  title: 'Raise with confidence',
                  desc: 'Walk into investor meetings with a data-backed performance report and a story that shows traction, not just potential.',
                },
              ].map(({ icon: Icon, step, color, title, desc }) => (
                <div key={step} className="group flex gap-4 rounded-xl border border-glass-border bg-glass backdrop-blur-sm p-4 hover:bg-glass-2 hover:border-glass-border transition-all duration-200">
                  <div className="flex-shrink-0 flex flex-col items-center gap-1.5 pt-0.5">
                    <div
                      className="h-8 w-8 rounded-lg flex items-center justify-center"
                      style={{ background: `${color}22`, border: `1px solid ${color}40` }}
                    >
                      <Icon className="h-3.5 w-3.5" style={{ color }} />
                    </div>
                    <span className="text-[10px] font-mono text-ink/20">{step}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-ink/90">{title}</p>
                      <CheckCircle2 className="h-3 w-3 text-ink/15 group-hover:text-ink/30 transition-colors flex-shrink-0" />
                    </div>
                    <p className="text-xs text-ink/35 leading-relaxed">{desc}</p>
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

/* ─── Sub-components ──────────────────────────────────────── */

function Field({ label, aside, children }: { label: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-ink/70">{label}</label>
        {aside}
      </div>
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
        'focus:border-glass-border focus:bg-glass-2 focus:ring-2 focus:ring-ink/5',
        className,
      )}
      {...props}
    />
  )
}

function PrimaryButton({ loading, children, className }: { loading?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className={cn(
        'w-full h-10 rounded-lg bg-ink text-page text-sm font-semibold',
        'hover:bg-ink/90 active:bg-ink/80 transition-colors',
        'disabled:opacity-60 flex items-center justify-center gap-2',
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

function ForgotPasswordFlow({ initialStep = 'request', onDone, onBack }: {
  initialStep?: 'request' | 'reset'; onDone: () => void; onBack: () => void
}) {
  const [step, setStep] = useState<'request' | 'reset'>(initialStep)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      toast.success('Reset code sent to your email'); setStep('reset')
    }
    catch (err) { toast.error(apiError(err, 'Failed to send reset code')) }
    finally { setLoading(false) }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    try {
      await api.post('/auth/reset-password', { email, code, newPassword })
      toast.success('Password reset. You can now sign in.'); onDone()
    }
    catch (err) { toast.error(apiError(err, 'Reset failed')) }
    finally { setLoading(false) }
  }

  return (
    <>
      <button onClick={onBack} className="mb-5 text-xs text-ink/40 hover:text-ink/70 transition-colors">← Back to sign in</button>
      {step === 'request' ? (
        <>
          <h1 className="text-2xl font-semibold text-ink mb-1">Forgot password</h1>
          <p className="text-sm text-ink/40 mb-7">Enter your email and we'll send a reset code.</p>
          <form onSubmit={handleRequest} className="space-y-4">
            <Field label="Email">
              <GlassInput type="email" placeholder="m@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            </Field>
            <PrimaryButton loading={loading}>Send reset code</PrimaryButton>
          </form>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold text-ink mb-1">Reset password</h1>
          <p className="text-sm text-ink/40 mb-7">Enter the code from your email and your new password.</p>
          <form onSubmit={handleReset} className="space-y-4">
            <Field label="Reset code">
              <GlassInput placeholder="000000" value={code} onChange={e => setCode(e.target.value)} required autoFocus inputMode="numeric" className="text-center tracking-widest" />
            </Field>
            <Field label="New password">
              <GlassInput type="password" placeholder="Min. 8 characters" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} />
            </Field>
            <PrimaryButton loading={loading}>Reset password</PrimaryButton>
          </form>
        </>
      )}
    </>
  )
}

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error
    ?? (err instanceof Error ? err.message : fallback)
}
