import type { AuthTokens, AuthUser } from '@/types/auth'

interface Handoff {
  tokens: AuthTokens
  user: AuthUser
}

/**
 * localStorage is per-origin, but subdomain routing means the browser often
 * needs a full cross-origin navigation right after login (e.g. admin.host →
 * {tenant}.host). Encoding the freshly-issued session into the destination
 * URL's fragment (never sent to the server, unlike query params) lets the
 * destination origin adopt it immediately — overwriting any stale session
 * already cached there from a previous, different login.
 */
export function encodeHandoff(tokens: AuthTokens, user: AuthUser): string {
  const json = JSON.stringify({ tokens, user } satisfies Handoff)
  return `#session=${btoa(encodeURIComponent(json))}`
}

export function consumeHandoffFromLocation(): Handoff | null {
  const hash = window.location.hash
  const match = /^#session=(.+)$/.exec(hash)
  if (!match) return null
  try {
    const json = decodeURIComponent(atob(match[1]))
    const parsed = JSON.parse(json) as Handoff
    if (!parsed?.tokens || !parsed?.user) return null
    return parsed
  } catch {
    return null
  }
}
