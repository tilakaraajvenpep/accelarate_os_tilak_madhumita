import { createContext, useContext, useEffect, ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { classifyHost } from '@/lib/host'
import { deriveThemeColors, blendHex, gradientCss, type DerivedTheme } from '@/lib/theme-color'

interface TenantSummary {
  id: number
  name: string
  slug: string
  logoUrl: string | null
  // A gradient theme: two colors ("from"/"to") stored in the same two fields
  // the earlier single/dual-tone designs used. Applied to the chrome (see
  // GLOBAL_THEME_KEYS/SCOPED_THEME_VARS below) in both light and dark mode.
  brandColor: string | null
  backgroundColor: string | null
}

interface TenantSlugContextValue {
  slug: string | null
  tenant: TenantSummary | null
  loading: boolean
}

const TenantSlugContext = createContext<TenantSlugContextValue | null>(null)

// Maps DerivedTheme's camelCase keys to the actual CSS custom property names they override.
const THEME_CSS_VARS: Record<keyof DerivedTheme, string> = {
  background: '--background',
  page: '--page',
  sidebar: '--sidebar',
  card: '--card',
  popover: '--popover',
  foreground: '--foreground',
  ink: '--ink',
  sidebarForeground: '--sidebar-foreground',
  cardForeground: '--card-foreground',
  popoverForeground: '--popover-foreground',
  mutedForeground: '--muted-foreground',
  muted: '--muted',
  secondary: '--secondary',
  accent: '--accent',
  sidebarAccent: '--sidebar-accent',
  secondaryForeground: '--secondary-foreground',
  accentForeground: '--accent-foreground',
  sidebarAccentForeground: '--sidebar-accent-foreground',
  primary: '--primary',
  primaryForeground: '--primary-foreground',
  sidebarPrimary: '--sidebar-primary',
  sidebarPrimaryForeground: '--sidebar-primary-foreground',
  border: '--border',
  input: '--input',
  sidebarBorder: '--sidebar-border',
  ring: '--ring',
  glass1: '--glass-1',
  glass2: '--glass-2',
  glassBorder: '--glass-bd',
}

// Buttons/accents anywhere in the app should reflect the tenant theme, and
// these are always used as matched pairs (bg-primary+text-primary-foreground,
// bg-accent+text-accent-foreground), so there's no risk of one ending up
// illegible against some unrelated element's own background — safe to set
// globally, on :root.
const GLOBAL_THEME_KEYS = new Set<keyof DerivedTheme>([
  'sidebar',
  'sidebarForeground',
  'sidebarAccent',
  'sidebarAccentForeground',
  'sidebarPrimary',
  'sidebarPrimaryForeground',
  'sidebarBorder',
  'primary',
  'primaryForeground',
  'accent',
  'accentForeground',
  'ring',
])
const GLOBAL_THEME_CSS_VARS = (Object.entries(THEME_CSS_VARS) as [keyof DerivedTheme, string][]).filter(([key]) =>
  GLOBAL_THEME_KEYS.has(key),
)

// ink/glass1/glass2/glassBorder are the "glassmorphism" tokens — but unlike
// primary/accent, they're reused standalone (not as a fixed pair) across many
// unrelated pages and components that were never meant to be part of the
// tenant's chrome (login, landing, invite flows, the founder dashboard — each
// against its OWN default background). Setting them on :root made them leak
// into all of those, turning text invisible wherever the surrounding
// background didn't also happen to be the tenant color (reported: profile
// menu and founder dashboard text disappearing). Scoping them via a
// dedicated <style> tag keyed to [data-theme-chrome] instead means only the
// real DOM descendants of the sidebar/header (not portaled popovers, and not
// unrelated pages) ever see the override.
const SCOPED_THEME_VARS: [keyof DerivedTheme, string][] = [
  ['ink', '--ink'],
  ['glass1', '--glass-1'],
  ['glass2', '--glass-2'],
  ['glassBorder', '--glass-bd'],
]
const SCOPED_STYLE_TAG_ID = 'tenant-chrome-theme'

/** Resolves the current tenant from the subdomain (e.g. acme.example.com). */
export function TenantSlugProvider({ children }: { children: ReactNode }) {
  const host = classifyHost(window.location.hostname, import.meta.env.VITE_BASE_DOMAIN)
  const slug = host.kind === 'tenant' ? host.slug : null

  const { data: tenant = null, isLoading } = useQuery({
    queryKey: ['tenant-by-slug', slug],
    queryFn: async () => (await api.get<TenantSummary>(`/api/tenants/by-slug/${slug}`)).data,
    enabled: !!slug,
  })

  // Applied in both light and dark mode — only the chrome tokens (see
  // GLOBAL_THEME_KEYS/SCOPED_THEME_VARS) are overridden, so this never fights
  // with dark mode's own neutral background/text defaults.
  const gradientFrom = tenant?.brandColor ?? null
  const gradientTo = tenant?.backgroundColor ?? null

  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) return
    const defaultHref = '/favicon.svg'
    link.href = tenant?.logoUrl || defaultHref
    return () => {
      link.href = defaultHref
    }
  }, [tenant?.logoUrl])

  useEffect(() => {
    const root = document.documentElement
    // Both colors are required — a lone color falls back to nothing rather
    // than guessing a partner for it, since a gradient theme is meaningfully
    // different from the flat-color theme it replaced.
    const hasGradient = !!gradientFrom && !!gradientTo
    const midpoint = hasGradient ? blendHex(gradientFrom!, gradientTo!) : null
    const derived = midpoint ? deriveThemeColors(midpoint) : null

    let styleTag = document.getElementById(SCOPED_STYLE_TAG_ID) as HTMLStyleElement | null

    if (derived && hasGradient) {
      for (const [key, cssVar] of GLOBAL_THEME_CSS_VARS) {
        root.style.setProperty(cssVar, derived[key])
      }
      root.style.setProperty('--tenant-gradient', gradientCss(gradientFrom!, gradientTo!))
      if (!styleTag) {
        styleTag = document.createElement('style')
        styleTag.id = SCOPED_STYLE_TAG_ID
        document.head.appendChild(styleTag)
      }
      const scopedDecls = SCOPED_THEME_VARS.map(([key, cssVar]) => `${cssVar}: ${derived[key]};`).join(' ')
      styleTag.textContent = `[data-theme-chrome] { ${scopedDecls} }`
      // A custom theme color can land anywhere on the light/dark spectrum, so
      // default (lighter) font weights can end up looking washed out — bump
      // text weight up within the themed chrome (see the [data-theme-chrome]
      // rules in index.css, which also paint the gradient there).
      root.classList.add('tenant-custom-bg')
    } else {
      for (const [, cssVar] of GLOBAL_THEME_CSS_VARS) root.style.removeProperty(cssVar)
      root.style.removeProperty('--tenant-gradient')
      if (styleTag) styleTag.textContent = ''
      root.classList.remove('tenant-custom-bg')
    }
    return () => {
      for (const [, cssVar] of GLOBAL_THEME_CSS_VARS) root.style.removeProperty(cssVar)
      root.style.removeProperty('--tenant-gradient')
      const tag = document.getElementById(SCOPED_STYLE_TAG_ID)
      if (tag) tag.textContent = ''
      root.classList.remove('tenant-custom-bg')
    }
  }, [gradientFrom, gradientTo])

  return (
    <TenantSlugContext.Provider value={{ slug, tenant, loading: !!slug && isLoading }}>
      {children}
    </TenantSlugContext.Provider>
  )
}

export function useTenantSlug() {
  const ctx = useContext(TenantSlugContext)
  if (!ctx) throw new Error('useTenantSlug must be used inside <TenantSlugProvider>')
  return ctx
}

/** Same as useTenantSlug, but safe to call outside the provider (e.g. on the super-admin host) — returns null instead of throwing. */
export function useOptionalTenantSlug() {
  return useContext(TenantSlugContext)
}
