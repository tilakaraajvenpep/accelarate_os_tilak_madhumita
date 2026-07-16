import { createContext, useContext, ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { classifyHost } from '@/lib/host'

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

/** Resolves the current tenant from the subdomain (e.g. acme.example.com). */
export function TenantSlugProvider({ children }: { children: ReactNode }) {
  const host = classifyHost(window.location.hostname, import.meta.env.VITE_BASE_DOMAIN)
  const slug = host.kind === 'tenant' ? host.slug : null

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
