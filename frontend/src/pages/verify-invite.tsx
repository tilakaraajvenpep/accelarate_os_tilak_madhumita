import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'

type Status = 'checking' | 'success' | 'error' | 'form'

export default function VerifyInvitePage() {
  const navigate = useNavigate()
  const { verifyInvite } = useAuth()
  const [searchParams] = useSearchParams()
  const emailFromLink = searchParams.get('email') ?? ''
  const codeFromLink = searchParams.get('code') ?? ''

  const [status, setStatus] = useState<Status>(emailFromLink && codeFromLink ? 'checking' : 'form')
  const [error, setError] = useState<string | null>(null)
  const [tenantName, setTenantName] = useState<string | null>(null)

  const [email, setEmail] = useState(emailFromLink)
  const [code, setCode] = useState(codeFromLink)
  const [submitting, setSubmitting] = useState(false)

  async function attemptVerify(verifyEmail: string, verifyCode: string) {
    try {
      const name = await verifyInvite(verifyEmail, verifyCode)
      setTenantName(name)
      setStatus('success')
    } catch (err: unknown) {
      setError(apiError(err, 'This verification link is invalid or has expired.'))
      setStatus('error')
    }
  }

  useEffect(() => {
    if (emailFromLink && codeFromLink) {
      attemptVerify(emailFromLink, codeFromLink)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    await attemptVerify(email, code)
    setSubmitting(false)
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
          <ThemeToggle />
        </div>
      </nav>

      <div className="relative z-10 mx-auto max-w-lg px-6 py-16">
        {status === 'checking' && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-ink/40" />
          </div>
        )}

        {status === 'success' && (
          <div className="text-center space-y-6">
            <div className="inline-flex h-20 w-20 rounded-full bg-glass border border-glass-border items-center justify-center mx-auto">
              <CheckCircle2 className="h-10 w-10 text-green-400" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-ink mb-2">Email verified</h1>
              <p className="text-sm text-ink/40">
                You can now sign in to <span className="text-ink/70 font-medium">{tenantName}</span> with the
                password you were given.
              </p>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="w-full h-11 rounded-xl bg-ink text-page font-semibold text-sm hover:bg-ink/90 transition-colors flex items-center justify-center gap-2"
            >
              Go to sign in →
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <h1 className="text-2xl font-semibold text-ink">This code isn't valid</h1>
              <p className="text-sm text-ink/40">{error}</p>
            </div>
            <VerifyForm
              email={email}
              code={code}
              submitting={submitting}
              onEmailChange={setEmail}
              onCodeChange={setCode}
              onSubmit={handleSubmit}
            />
          </div>
        )}

        {status === 'form' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-ink mb-1">Verify your email</h1>
              <p className="text-sm text-ink/40">Enter the code we emailed you to activate your admin account.</p>
            </div>
            <VerifyForm
              email={email}
              code={code}
              submitting={submitting}
              onEmailChange={setEmail}
              onCodeChange={setCode}
              onSubmit={handleSubmit}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function VerifyForm({
  email,
  code,
  submitting,
  onEmailChange,
  onCodeChange,
  onSubmit,
}: {
  email: string
  code: string
  submitting: boolean
  onEmailChange: (v: string) => void
  onCodeChange: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormField label="Email">
        <GlassInput type="email" value={email} onChange={(e) => onEmailChange(e.target.value)} required />
      </FormField>
      <FormField label="Verification code">
        <GlassInput
          placeholder="000000"
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          required
          inputMode="numeric"
          maxLength={6}
          className="text-center text-2xl tracking-[0.4em] font-mono"
        />
      </FormField>
      <button
        type="submit"
        disabled={submitting}
        className="w-full h-11 rounded-xl bg-ink text-page font-semibold text-sm hover:bg-ink/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify email'}
      </button>
    </form>
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

function apiError(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
    (err instanceof Error ? err.message : fallback)
  )
}
