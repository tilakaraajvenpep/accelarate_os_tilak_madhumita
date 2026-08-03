import { Response, NextFunction } from 'express'
import { getTenantBySlug } from '../services/tenants.service'
import type { AuthRequest } from './auth.middleware'

export interface TenantRequest extends AuthRequest {
  resolvedTenant?: { id: number; slug: string } | null
}

/**
 * Resolves the tenant implied by the frontend's X-Tenant-Slug header (sent
 * only on tenant-subdomain hosts). Resolution-only — never blocks the
 * request, even if the slug doesn't exist.
 */
export async function resolveTenantFromHeader(req: TenantRequest, _res: Response, next: NextFunction) {
  const header = req.headers['x-tenant-slug']
  const slug = typeof header === 'string' ? header : undefined
  req.resolvedTenant = slug ? await getTenantBySlug(slug) : null
  next()
}

/**
 * Defense-in-depth: if the client told us which tenant subdomain it's on,
 * make sure the authenticated user actually belongs to that tenant. Must run
 * after loadUser + resolveTenantFromHeader. No-ops when no X-Tenant-Slug
 * header was sent, so older clients aren't broken.
 */
export function requireTenantMatch(req: TenantRequest, res: Response, next: NextFunction) {
  const header = req.headers['x-tenant-slug']
  if (typeof header !== 'string') {
    next()
    return
  }
  if (!req.dbUser || req.dbUser.tenantId !== (req.resolvedTenant?.id ?? null)) {
    res.status(403).json({ error: 'Tenant mismatch' })
    return
  }
  next()
}
