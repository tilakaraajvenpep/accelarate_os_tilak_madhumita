import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { ThemeToggle } from '@/components/theme-toggle'
import { LanguageSwitcher } from '@/components/language-switcher'

function apiError(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? (err instanceof Error ? err.message : fallback)
}

export default function AcceptCompanyInvitePage() {
  const navigate = useNavigate()
  const params = new URLSearchParams(window.location.search)
  const companyId = params.get('companyId') ?? ''
  const email = params.get('email') ?? ''

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)

  const acceptMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/api/company-member-invites/${companyId}/accept`, {
          email,
          code,
          name: name || undefined,
          password: password || undefined,
        })
      ).data,
    onSuccess: () => setDone(true),
    onError: (err) => toast.error(apiError(err, 'Failed to accept invite')),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) {
      toast.error('Verification code is required')
      return
    }
    acceptMutation.mutate()
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
        {!companyId || !email ? (
          <div className="text-center space-y-4 py-16">
            <div className="inline-flex h-16 w-16 rounded-full bg-glass border border-glass-border shadow-sm items-center justify-center mx-auto">
              <AlertCircle className="h-7 w-7 text-destructive" />
            </div>
            <h1 className="text-xl font-semibold">This invite link is invalid</h1>
          </div>
        ) : done ? (
          <div className="text-center space-y-6 rounded-2xl border border-glass-border bg-glass backdrop-blur-xl shadow-xl p-8 sm:p-10">
            <div className="inline-flex h-20 w-20 rounded-full bg-glass border border-glass-border shadow-md items-center justify-center mx-auto">
              <CheckCircle2 className="h-10 w-10 text-ink" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold mb-2">You're in</h1>
              <p className="text-sm text-ink/40">Sign in with your account to start collaborating.</p>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="w-full h-11 rounded-xl bg-ink text-page font-semibold text-sm shadow-md hover:bg-ink/90 hover:shadow-lg transition-all"
            >
              Go to sign in
            </button>
          </div>
        ) : (
          <form noValidate onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-glass-border bg-glass backdrop-blur-xl shadow-xl p-8 sm:p-10">
            <div>
              <h1 className="text-2xl font-semibold mb-1">Join your team</h1>
              <p className="text-sm text-ink/40">
                Accepting as <span className="text-ink/70 font-medium">{email}</span>
              </p>
            </div>

            <div className="space-y-4">
              <FormField label="Verification code">
                <GlassInput placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} required maxLength={6} autoFocus />
              </FormField>
              <FormField label="Name (new accounts only)">
                <GlassInput placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
              </FormField>
              <FormField label="Password (new accounts only)">
                <GlassPasswordInput placeholder="Set a password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} />
              </FormField>
              <p className="text-xs text-ink/30">
                Already have an AccelerateOS account with this email? Leave name and password blank — just enter the code.
              </p>
            </div>

            <button
              type="submit"
              disabled={acceptMutation.isPending}
              className="w-full h-11 rounded-xl bg-ink text-page font-semibold text-sm shadow-md hover:bg-ink/90 hover:shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {acceptMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Join company'}
            </button>
          </form>
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
