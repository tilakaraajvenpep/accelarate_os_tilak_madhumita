import { useNavigate } from 'react-router-dom'
import {
  ScanLine, Map, Rocket, TrendingUp,
  BarChart3, Users, ShieldCheck, Layers, ArrowRight,
} from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { LanguageToggle } from '@/i18n/LanguageToggle'
import { useTranslation } from '@/i18n/I18nProvider'

export default function LandingPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const FEATURES = [
    { icon: ScanLine, color: 'oklch(0.65 0.22 265)', titleKey: 'landing.features.aiEval.title', descKey: 'landing.features.aiEval.desc' },
    { icon: BarChart3, color: 'oklch(0.65 0.20 200)', titleKey: 'landing.features.liveDash.title', descKey: 'landing.features.liveDash.desc' },
    { icon: Users, color: 'oklch(0.65 0.22 310)', titleKey: 'landing.features.mentorNetwork.title', descKey: 'landing.features.mentorNetwork.desc' },
    { icon: Layers, color: 'oklch(0.70 0.18 145)', titleKey: 'landing.features.multiTenant.title', descKey: 'landing.features.multiTenant.desc' },
    { icon: TrendingUp, color: 'oklch(0.65 0.22 30)', titleKey: 'landing.features.investorReport.title', descKey: 'landing.features.investorReport.desc' },
    { icon: ShieldCheck, color: 'oklch(0.65 0.20 240)', titleKey: 'landing.features.security.title', descKey: 'landing.features.security.desc' },
  ]

  const JOURNEY = [
    { icon: ScanLine, step: '01', color: 'oklch(0.65 0.22 265)', titleKey: 'landing.journey.assess.title', descKey: 'landing.journey.assess.desc' },
    { icon: Map, step: '02', color: 'oklch(0.65 0.20 200)', titleKey: 'landing.journey.align.title', descKey: 'landing.journey.align.desc' },
    { icon: Rocket, step: '03', color: 'oklch(0.65 0.22 310)', titleKey: 'landing.journey.execute.title', descKey: 'landing.journey.execute.desc' },
    { icon: TrendingUp, step: '04', color: 'oklch(0.70 0.18 145)', titleKey: 'landing.journey.raise.title', descKey: 'landing.journey.raise.desc' },
  ]

  return (
    <div className="relative bg-page text-ink overflow-x-hidden">
      {/* ── Persistent aurora ─────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 -left-40 h-[700px] w-[700px] rounded-full bg-[oklch(0.55_0.22_265)] opacity-[0.15] blur-[160px]" />
        <div className="absolute top-1/3 right-0 h-[600px] w-[500px] rounded-full bg-[oklch(0.58_0.22_30)] opacity-[0.10] blur-[140px]" />
        <div className="absolute bottom-0 left-1/4 h-[500px] w-[500px] rounded-full bg-[oklch(0.50_0.25_310)] opacity-[0.10] blur-[130px]" />
      </div>

      {/* ── Nav ───────────────────────────────────────── */}
      <nav className="relative z-10 sticky top-0 border-b border-glass-border bg-page/80 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-glass-2 border border-glass-border flex items-center justify-center font-bold text-sm">A</div>
            <span className="font-semibold tracking-tight">{t('common.brand')}</span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <ThemeToggle />
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-ink/50 hover:text-ink transition-colors px-4 py-2"
            >
              {t('landing.nav.signIn')}
            </button>
            <button
              onClick={() => navigate('/get-started')}
              className="text-sm font-medium bg-ink text-page px-4 py-2 rounded-lg hover:bg-ink/90 transition-colors"
            >
              {t('landing.nav.getStarted')}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pt-28 pb-20 text-center">
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.08] tracking-tight mb-6">
          {t('landing.hero.titleLine1')}<br />
          <span className="text-ink/40">{t('landing.hero.titleLine2')}</span>
        </h1>
        <p className="text-lg text-ink/40 max-w-2xl mx-auto mb-10 leading-relaxed">
          {t('landing.hero.subtitle')}
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => navigate('/get-started')}
            className="group flex items-center gap-2 bg-ink text-page font-semibold px-6 py-3 rounded-xl hover:bg-ink/90 transition-colors text-sm"
          >
            {t('landing.hero.startProgram')}
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
          <button
            onClick={() => navigate('/login')}
            className="text-sm text-ink/50 hover:text-ink transition-colors px-6 py-3 rounded-xl border border-glass-border hover:border-glass-border hover:bg-glass"
          >
            {t('landing.hero.signInToAccount')}
          </button>
        </div>

        {/* Hero glass dashboard preview */}
        <div className="mt-20 relative mx-auto max-w-4xl">
          <div className="rounded-2xl border border-glass-border bg-glass backdrop-blur-sm p-6 shadow-2xl shadow-black/50">
            {/* Fake dashboard header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-red-500/70" />
                <div className="h-2 w-2 rounded-full bg-yellow-500/70" />
                <div className="h-2 w-2 rounded-full bg-green-500/70" />
                <div className="ml-2 h-5 w-48 rounded bg-glass" />
              </div>
              <div className="h-7 w-7 rounded-full bg-glass-2" />
            </div>
            {/* Stat cards row */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { labelKey: 'landing.hero.preview.activeFounders', value: '24', color: 'oklch(0.65 0.22 265)' },
                { labelKey: 'landing.hero.preview.avgReadiness', value: '7.2', color: 'oklch(0.65 0.20 200)' },
                { labelKey: 'landing.hero.preview.daysToDemo', value: '31', color: 'oklch(0.65 0.22 310)' },
                { labelKey: 'landing.hero.preview.actionsOpen', value: '48', color: 'oklch(0.70 0.18 145)' },
              ].map(({ labelKey, value, color }) => (
                <div key={labelKey} className="rounded-xl border border-glass-border bg-glass p-3">
                  <p className="text-[10px] text-ink/30 mb-1">{t(labelKey)}</p>
                  <p className="text-xl font-bold" style={{ color }}>{value}</p>
                </div>
              ))}
            </div>
            {/* Progress bars */}
            <div className="space-y-2">
              {[
                { nameKey: 'landing.hero.preview.productTech', pct: 78 },
                { nameKey: 'landing.hero.preview.goToMarket', pct: 54 },
                { nameKey: 'landing.hero.preview.financeOps', pct: 41 },
              ].map(({ nameKey, pct }) => (
                <div key={nameKey} className="flex items-center gap-3">
                  <p className="text-xs text-ink/30 w-28 text-right flex-shrink-0">{t(nameKey)}</p>
                  <div className="flex-1 h-1.5 rounded-full bg-glass">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[oklch(0.55_0.22_265)] to-[oklch(0.65_0.22_200)]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-ink/25 w-8 flex-shrink-0">{pct}%</p>
                </div>
              ))}
            </div>
          </div>
          {/* Glow under card */}
          <div className="absolute inset-x-12 -bottom-8 h-16 bg-[oklch(0.55_0.22_265)] opacity-20 blur-2xl rounded-full" />
        </div>
      </section>

      {/* ── Stats bar ─────────────────────────────────── */}
      <section className="relative z-10 border-y border-glass-border bg-glass">
        <div className="mx-auto max-w-6xl px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '200+', labelKey: 'landing.stats.programsLaunched' },
            { value: '5,000+', labelKey: 'landing.stats.foundersServed' },
            { value: '8', labelKey: 'landing.stats.evaluationPillars' },
            { value: '94%', labelKey: 'landing.stats.cohortCompletionRate' },
          ].map(({ value, labelKey }) => (
            <div key={labelKey}>
              <p className="text-3xl font-bold text-ink">{value}</p>
              <p className="text-sm text-ink/35 mt-1">{t(labelKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ──────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-24">
        <div className="text-center mb-14">
          <p className="text-xs uppercase tracking-[0.18em] text-ink/30 mb-3">{t('landing.features.eyebrow')}</p>
          <h2 className="text-4xl font-bold">{t('landing.features.titleLine1')}<br /><span className="text-ink/40">{t('landing.features.titleLine2')}</span></h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, color, titleKey, descKey }) => (
            <div key={titleKey} className="group rounded-2xl border border-glass-border bg-glass p-6 hover:bg-glass-2 hover:border-glass-border transition-all duration-200">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `${color}22`, border: `1px solid ${color}33` }}
              >
                <Icon className="h-5 w-5" style={{ color }} />
              </div>
              <h3 className="font-semibold text-ink mb-2">{t(titleKey)}</h3>
              <p className="text-sm text-ink/40 leading-relaxed">{t(descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Journey ───────────────────────────────────── */}
      <section className="relative z-10 border-y border-glass-border bg-glass">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="text-center mb-14">
            <p className="text-xs uppercase tracking-[0.18em] text-ink/30 mb-3">{t('landing.journey.eyebrow')}</p>
            <h2 className="text-4xl font-bold">{t('landing.journey.titleLine1')}<br /><span className="text-ink/40">{t('landing.journey.titleLine2')}</span></h2>
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            {JOURNEY.map(({ icon: Icon, step, color, titleKey, descKey }, i) => (
              <div key={step} className="relative">
                {i < 3 && (
                  <div className="hidden md:block absolute top-5 left-full w-full h-px bg-gradient-to-r from-glass-border to-transparent z-10" />
                )}
                <div className="rounded-2xl border border-glass-border bg-glass p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `${color}22`, border: `1px solid ${color}33` }}>
                      <Icon className="h-5 w-5" style={{ color }} />
                    </div>
                    <span className="text-xs font-mono text-ink/20">{step}</span>
                  </div>
                  <h3 className="font-semibold text-ink mb-2">{t(titleKey)}</h3>
                  <p className="text-sm text-ink/40 leading-relaxed">{t(descKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonial ───────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-24">
        <div className="rounded-2xl border border-glass-border bg-glass backdrop-blur-sm p-10 md:p-14 text-center">
          <div className="flex justify-center gap-1 mb-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <svg key={i} className="h-4 w-4 fill-yellow-400/80" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
            ))}
          </div>
          <blockquote className="text-xl md:text-2xl font-medium text-ink/80 leading-relaxed max-w-3xl mx-auto mb-8">
            {t('landing.testimonial.quote')}
          </blockquote>
          <div className="flex items-center justify-center gap-3">
            <div className="h-10 w-10 rounded-full bg-glass-2 border border-glass-border flex items-center justify-center font-bold text-ink/70">S</div>
            <div className="text-left">
              <p className="text-sm font-medium text-ink/70">{t('landing.testimonial.name')}</p>
              <p className="text-xs text-ink/30">{t('landing.testimonial.role')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA banner ────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-2xl border border-glass-border bg-gradient-to-br from-[oklch(0.25_0.08_265)] to-[oklch(0.12_0.04_265)] p-12 text-center">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-[oklch(0.55_0.22_265)] opacity-20 blur-3xl" />
            <div className="absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-[oklch(0.50_0.25_310)] opacity-15 blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{t('landing.cta.title')}</h2>
            <p className="text-white/60 mb-8 max-w-lg mx-auto">{t('landing.cta.subtitle')}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => navigate('/get-started')}
                className="group flex items-center gap-2 bg-white text-[oklch(0.20_0.08_265)] font-semibold px-7 py-3 rounded-xl hover:bg-white/90 transition-colors text-sm"
              >
                {t('landing.cta.startFree')}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button
                onClick={() => navigate('/login')}
                className="text-sm text-white/60 hover:text-white transition-colors"
              >
                {t('landing.cta.alreadyHaveAccount')}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-glass-border bg-glass">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-6 rounded-md bg-glass-2 border border-glass-border flex items-center justify-center font-bold text-xs">A</div>
            <span className="text-sm text-ink/50">{t('common.brand')}</span>
          </div>
          <p className="text-xs text-ink/25">{t('landing.footer.copyright', { year: new Date().getFullYear() })}</p>
          <div className="flex items-center gap-5">
            {[
              { key: 'landing.footer.privacy' },
              { key: 'landing.footer.terms' },
              { key: 'landing.footer.contact' },
            ].map((l) => (
              <a key={l.key} href="#" className="text-xs text-ink/30 hover:text-ink/60 transition-colors">{t(l.key)}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
