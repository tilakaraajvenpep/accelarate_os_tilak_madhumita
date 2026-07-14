import { createContext, useContext, ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface TenantSummary {
  id: number
  name: string
  slug: string
}

interface TenantSlugContextValue {
  slug: string | null
  tenant: TenantSummary | null
  loading: boolean
}

const TenantSlugContext = createContext<TenantSlugContextValue | null>(null)

/**
 * Resolves the current tenant from the URL. Today this only reads the `:slug`
 * route param (path-based routing, e.g. /t/acme/...). There's no DNS/TLS
 * infra set up yet for real subdomains — when that's ready, swap the `slug`
 * resolution below for a `window.location.hostname` parse; nothing that
 * consumes `useTenantSlug()` needs to change.
 */
export function TenantSlugProvider({ children }: { children: ReactNode }) {
  const { slug: routeSlug } = useParams<{ slug: string }>()
  const slug = routeSlug ?? null

  const { data: tenant = null, isLoading } = useQuery({
    queryKey: ['tenant-by-slug', slug],
    queryFn: async () => (await api.get<TenantSummary>(`/api/tenants/by-slug/${slug}`)).data,
    enabled: !!slug,
  })

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
