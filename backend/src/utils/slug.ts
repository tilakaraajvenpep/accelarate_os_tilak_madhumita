import { eq, like } from 'drizzle-orm'
import { db } from '../db/client'
import { tenants } from '../models'

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function generateUniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || 'tenant'

  const [exact, prefixed] = await Promise.all([
    db.select({ slug: tenants.slug }).from(tenants).where(eq(tenants.slug, root)),
    db.select({ slug: tenants.slug }).from(tenants).where(like(tenants.slug, `${root}-%`)),
  ])

  if (exact.length === 0) return root

  const taken = new Set([...exact, ...prefixed].map((t) => t.slug))
  let n = 2
  while (taken.has(`${root}-${n}`)) n++
  return `${root}-${n}`
}
