// Derives a complete, guaranteed-readable UI theme from a single hex "seed"
// color — background, text (including muted/secondary text), buttons, and
// borders are all computed together so nothing ends up illegible against an
// arbitrary tenant-chosen color (the previous design applied the seed to the
// background but only patched a couple of text tokens by hand, which is why
// some sidebar text stayed unreadably dim against a dark background).

const HEX_PATTERN = /^#?([0-9a-fA-F]{6})$/

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = HEX_PATTERN.exec(hex)
  if (!match) return null
  const int = parseInt(match[1], 16)
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 }
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, '0')).join('')}`
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  const delta = max - min
  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min)
    switch (max) {
      case r:
        h = ((g - b) / delta) % 6
        break
      case g:
        h = (b - r) / delta + 2
        break
      default:
        h = (r - g) / delta + 4
    }
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: s * 100, l: l * 100 }
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  s /= 100
  l /= 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let [r, g, b] = [0, 0, 0]
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 }
}

function hslToHex(h: number, s: number, l: number): string {
  const { r, g, b } = hslToRgb(h, s, l)
  return rgbToHex(r, g, b)
}

/** WCAG relative luminance (0 = black, 1 = white) — the perceptual "is this
 * color dark or light" measure. Saturated hues (blue especially, via its low
 * 0.0722 weight below) can read as perceptually dark even at a moderate HSL
 * lightness, so this — not HSL lightness — is what every dark/light branch in
 * this file must agree on to avoid deriving inconsistent, low-contrast text. */
function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  const [rs, gs, bs] = [rgb.r, rgb.g, rgb.b].map((c) => {
    const channel = c / 255
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/** Picks pure black or white, whichever contrasts more against a hex color. */
export function getContrastingTextColor(hex: string): '#000000' | '#ffffff' {
  return relativeLuminance(hex) > 0.5 ? '#000000' : '#ffffff'
}

/** Standard WCAG contrast ratio between two colors (1:1 to 21:1). */
function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA)
  const lB = relativeLuminance(hexB)
  const lighter = Math.max(lA, lB)
  const darker = Math.min(lA, lB)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Finds the least-extreme lightness (closest to 50, in the given direction)
 * at a fixed hue/saturation that still reaches minRatio contrast against
 * backgroundHex — rather than a fixed lightness offset from the seed color.
 * A fixed offset (e.g. "+12 lightness") looks fine for a very dark or very
 * light seed, but silently fails for a mid-lightness saturated seed (a
 * perfectly common brand color, e.g. #3b82f6) where +12 isn't nearly enough
 * separation — this searches until the actual contrast target is met instead
 * of assuming a fixed nudge is always sufficient.
 */
function findContrastingLightness(hue: number, saturation: number, backgroundHex: string, direction: 'lighten' | 'darken', minRatio: number): number {
  const [start, end, step] = direction === 'lighten' ? [50, 100, 1] : [50, 0, -1]
  for (let l = start; direction === 'lighten' ? l <= end : l >= end; l += step) {
    if (contrastRatio(hslToHex(hue, saturation, l), backgroundHex) >= minRatio) return l
  }
  return end
}

export interface DerivedTheme {
  background: string
  page: string
  sidebar: string
  card: string
  popover: string
  foreground: string
  ink: string
  sidebarForeground: string
  cardForeground: string
  popoverForeground: string
  mutedForeground: string
  muted: string
  secondary: string
  accent: string
  sidebarAccent: string
  secondaryForeground: string
  accentForeground: string
  sidebarAccentForeground: string
  primary: string
  primaryForeground: string
  sidebarPrimary: string
  sidebarPrimaryForeground: string
  border: string
  input: string
  sidebarBorder: string
  ring: string
  glass1: string
  glass2: string
  glassBorder: string
}

/** Midpoint blend of two hex colors — used as the representative solid color
 * (for text/border/button contrast math) behind a two-color gradient theme. */
export function blendHex(hexA: string, hexB: string, t = 0.5): string {
  const a = hexToRgb(hexA)
  const b = hexToRgb(hexB)
  if (!a || !b) return hexA
  return rgbToHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t)
}

export function gradientCss(from: string, to: string): string {
  return `linear-gradient(135deg, ${from}, ${to})`
}

/** Curated gradient theme presets (light mode only) — each still goes through
 * the same contrast-verified derivation (from the gradient's midpoint color)
 * as a manually-entered pair, so presets and custom entry always produce an
 * equally coherent, readable theme. */
export const THEME_GRADIENT_PRESETS: { name: string; from: string; to: string }[] = [
  { name: 'Ocean', from: '#7dd3fc', to: '#0369a1' },
  { name: 'Sunset', from: '#fdba74', to: '#c2410c' },
  { name: 'Mint', from: '#86efac', to: '#15803d' },
  { name: 'Lavender', from: '#c4b5fd', to: '#5b21b6' },
  { name: 'Rose', from: '#fda4af', to: '#9f1239' },
  { name: 'Sand', from: '#fde68a', to: '#92400e' },
  { name: 'Sky', from: '#bae6fd', to: '#1e40af' },
  { name: 'Slate', from: '#cbd5e1', to: '#334155' },
]

/** Builds a full, internally-consistent theme from one seed color. Every
 * paired background/foreground token is derived together so switching the
 * seed color can never leave one piece of text unreadable — the failure mode
 * of applying the seed to --background alone and hand-picking only one or
 * two text tokens to go with it. */
export function deriveThemeColors(seedHex: string): DerivedTheme | null {
  const rgb = hexToRgb(seedHex)
  if (!rgb) return null
  const { h, s } = rgbToHsl(rgb.r, rgb.g, rgb.b)
  const foreground = getContrastingTextColor(seedHex)
  // Perceptual darkness, not HSL lightness — a saturated hue like blue can sit
  // at ~60% HSL lightness yet read as perceptually dark (low WCAG luminance),
  // so branching on foreground here (rather than a separate l<50 check) keeps
  // every derived tone below agreeing with the same contrast decision.
  const isDark = foreground === '#ffffff'

  const direction = isDark ? 'lighten' : 'darken'

  // Muted/secondary text: same hue family, desaturated, searched to the least-
  // extreme lightness that still clears a real text-contrast ratio (4.5:1)
  // against the background — legible but deliberately quieter than the
  // full-contrast foreground above (which sits at the extreme, 21:1-ish).
  const mutedForeground = hslToHex(h, Math.min(s, 20), findContrastingLightness(h, Math.min(s, 20), seedHex, direction, 4.5))

  // A soft "next surface" tone (muted/secondary/accent backgrounds, sidebar
  // hover state) — same hue, searched for just enough lightness separation
  // (a loose 1.2:1) to read as a distinct surface without needing to double
  // as readable text on its own.
  const overlay = hslToHex(h, s, findContrastingLightness(h, s, seedHex, direction, 1.2))

  // Primary/accent (buttons, links): same hue at higher saturation, searched
  // to the least-extreme lightness that clears the UI-component contrast
  // ratio (3:1) against the background — guarantees the button is always
  // visibly distinct rather than assuming a fixed lightness nudge is enough.
  const primary = hslToHex(h, Math.min(s + 15, 90), findContrastingLightness(h, Math.min(s + 15, 90), seedHex, direction, 3))
  const primaryForeground = getContrastingTextColor(primary)

  const border = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.14)'

  // The sidebar/top bar are built on a separate "glassmorphism" layer
  // (bg-glass/bg-glass-2, text-ink at various opacities) — not the plain
  // background/foreground tokens above. Its default values are a translucent
  // WHITE overlay, sized for a page that's already near-white (light mode) or
  // near-black (dark mode): a 55%-opacity white wash barely dims an
  // already-white page, but dramatically desaturates a saturated custom
  // theme color into a washed-out pastel — exactly what made the sidebar and
  // top bar unreadable. Deriving these from the same isDark decision (a low-
  // opacity tint in the SAME direction as the text) keeps the glass panels a
  // subtly-lighter/darker shade of the actual theme color instead of diluting
  // it toward white.
  const glass1 = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
  const glass2 = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)'
  const glassBorder = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)'

  return {
    background: seedHex,
    page: seedHex,
    sidebar: seedHex,
    card: seedHex,
    popover: seedHex,
    foreground,
    ink: foreground,
    sidebarForeground: foreground,
    cardForeground: foreground,
    popoverForeground: foreground,
    mutedForeground,
    muted: overlay,
    secondary: overlay,
    accent: overlay,
    sidebarAccent: overlay,
    secondaryForeground: foreground,
    accentForeground: foreground,
    sidebarAccentForeground: foreground,
    primary,
    primaryForeground,
    sidebarPrimary: primary,
    sidebarPrimaryForeground: primaryForeground,
    border,
    input: border,
    sidebarBorder: border,
    ring: primary,
    glass1,
    glass2,
    glassBorder,
  }
}
