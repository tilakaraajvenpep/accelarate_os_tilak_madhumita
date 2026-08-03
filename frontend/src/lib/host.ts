export type HostClass = { kind: 'apex' } | { kind: 'admin' } | { kind: 'tenant'; slug: string }

/** Mirrors backend/src/utils/host.ts so both sides classify hosts identically. */
export function classifyHost(hostname: string, baseDomain: string): HostClass {
  const host = hostname.toLowerCase()
  const base = baseDomain.toLowerCase()

  if (host === base || host === `www.${base}`) return { kind: 'apex' }
  if (host === `admin.${base}`) return { kind: 'admin' }

  const suffix = `.${base}`
  if (host.endsWith(suffix)) {
    const label = host.slice(0, -suffix.length)
    if (label.length > 0 && !label.includes('.') && /^[a-z0-9-]+$/.test(label)) {
      return { kind: 'tenant', slug: label }
    }
  }

  return { kind: 'apex' }
}

function devPort(baseDomain: string): string {
  return baseDomain.toLowerCase() === 'localhost' && import.meta.env.DEV ? ':5173' : ''
}

function originFor(hostname: string, baseDomain: string): string {
  return `${window.location.protocol}//${hostname}${devPort(baseDomain)}`
}

export function apexUrl(baseDomain: string): string {
  return originFor(baseDomain, baseDomain)
}

export function adminUrl(baseDomain: string): string {
  return originFor(`admin.${baseDomain}`, baseDomain)
}

export function tenantUrl(slug: string, baseDomain: string): string {
  return originFor(`${slug}.${baseDomain}`, baseDomain)
}
