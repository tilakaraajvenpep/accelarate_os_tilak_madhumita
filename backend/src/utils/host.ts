/**
 * Classifies request origins/hostnames into one of three host classes for
 * subdomain-based tenant routing: apex/marketing, admin, or a tenant
 * subdomain. Mirrors frontend/src/lib/host.ts so both sides agree on shape.
 */
export function isAllowedOrigin(origin: string, baseDomain: string): boolean {
  let hostname: string
  try {
    hostname = new URL(origin).hostname.toLowerCase()
  } catch {
    return false
  }

  const base = baseDomain.toLowerCase()
  if (hostname === base || hostname === `www.${base}` || hostname === `admin.${base}`) {
    return true
  }

  const suffix = `.${base}`
  if (hostname.endsWith(suffix)) {
    const label = hostname.slice(0, -suffix.length)
    return label.length > 0 && !label.includes('.') && /^[a-z0-9-]+$/.test(label)
  }

  return false
}

/** Mirrors frontend/src/lib/host.ts's tenantUrl — dev uses the fixed :5173 Vite port. */
export function tenantUrl(slug: string, baseDomain: string): string {
  const isDev = baseDomain.toLowerCase() === 'localhost'
  const protocol = isDev ? 'http' : 'https'
  const port = isDev ? ':5173' : ''
  return `${protocol}://${slug}.${baseDomain}${port}`
}

/** Mirrors frontend/src/lib/host.ts's apexUrl — where the marketing site / signup wizard lives. */
export function apexUrl(baseDomain: string): string {
  const isDev = baseDomain.toLowerCase() === 'localhost'
  const protocol = isDev ? 'http' : 'https'
  const port = isDev ? ':5173' : ''
  return `${protocol}://${baseDomain}${port}`
}
