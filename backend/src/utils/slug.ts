import { eq, like } from 'drizzle-orm'
import { db } from '../db/client'
import { tenants } from '../models'

// Slugs double as DNS subdomain labels (e.g. {slug}.example.com) — these are
// hostnames that would collide with real infrastructure/routes if allowed.
export const RESERVED_SLUGS = new Set([
  'www', 'api', 'app', 'admin', 'mail', 'ftp', 'smtp', 'imap',
  'ns1', 'ns2', 'autodiscover', 'webmail', 'cdn', 'static', 'assets',
  'docs', 'help', 'support', 'status', 'blog', 'dev', 'staging', 'test',
  'localhost', 'root', 'billing', 'dashboard', 'portal', 'my', 'account',
  'auth', 'login', 'signup', 'register', 'superadmin', 'super-admin',
  'platform', 'internal', 'secure', 'ssl',
])

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase())
}

const MAX_SLUG_LENGTH = 63 // DNS label max

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, '')
}

export async function generateUniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || 'tenant'

  const [exact, prefixed] = await Promise.all([
    db.select({ slug: tenants.slug }).from(tenants).where(eq(tenants.slug, root)),
    db.select({ slug: tenants.slug }).from(tenants).where(like(tenants.slug, `${root}-%`)),
  ])

  if (exact.length === 0 && !isReservedSlug(root)) return root

  const taken = new Set([...exact, ...prefixed].map((t) => t.slug))
  if (isReservedSlug(root)) taken.add(root)
  let n = 2
  while (taken.has(`${root}-${n}`)) n++
  return `${root}-${n}`
}
