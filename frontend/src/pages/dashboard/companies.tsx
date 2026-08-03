import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Building2, Eye, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { api } from '@/lib/api'
import { ListToolbar, ListPagination } from '@/components/list-toolbar'
import { useListControls } from '@/hooks/use-list-controls'
import { Loader } from '@/components/ui/loader'
import { Button } from '@/components/ui/button'
import { UserPermissionsDialog, type PermissionUser } from '@/components/user-permissions-dialog'
import type { CompanyEntry, CompanyEntryStatus } from '@/types/company'

function statusInfo(status: CompanyEntryStatus) {
  if (status === 'active') return { label: 'Active', cls: 'text-emerald-800 bg-emerald-50 border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-800' }
  if (status === 'expired') return { label: 'Expired', cls: 'text-red-800 bg-red-50 border border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800' }
  return { label: 'Invited', cls: 'text-amber-800 bg-amber-50 border border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-800' }
}

export default function CompaniesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation('companies')
  const queryClient = useQueryClient()
  const [permissionsOpen, setPermissionsOpen] = useState(false)
  const [permissionsUser, setPermissionsUser] = useState<PermissionUser | null>(null)

  function openPermissionsFor(entry: CompanyEntry) {
    setPermissionsUser({
      id: entry.founderUserId!,
      name: entry.founderName,
      email: entry.email,
      role: 'founder',
      allowedMenus: entry.allowedMenus ?? null,
      canSetPermissions: !!entry.canSetPermissions,
    })
    setPermissionsOpen(true)
  }

  function canManagePermissions(entry: CompanyEntry) {
    return (user?.role === 'admin' || user?.canSetPermissions) && !!entry.founderUserId
  }

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['company-entries'],
    queryFn: async () => (await api.get<CompanyEntry[]>('/api/tenants/me/companies')).data,
    enabled: user?.role === 'admin',
  })

  const controls = useListControls(entries, {
    searchFields: (entry) => [entry.name, entry.founderName, entry.email, entry.cohortName],
    statusValue: (entry) => entry.status === 'active',
  })

  if (user?.role !== 'admin') {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-lg text-muted-foreground font-semibold">{t('notAvailable')}</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* Page Title Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">{t('page.title')}</h1>
        <p className="text-base text-muted-foreground">{t('page.subtitle')}</p>
      </div>

      {/* Main Table Workspace */}
      <div className="surface-card overflow-hidden">
        
        {/* Workspace Title bar */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-bold text-foreground">{t('table.cardTitle')}</h2>
          </div>
          {!isLoading && (
            <span className="text-sm font-semibold px-3 py-1 bg-muted text-muted-foreground rounded-full">
              {controls.filtered.length} {t('table.cardTitle').toLowerCase()}
            </span>
          )}
        </div>

        {/* Toolbar */}
        <div className="px-6 py-4.5 border-b border-border bg-muted/20">
          <ListToolbar
            controls={controls}
            searchPlaceholder={t('common:search')}
            activeLabel={t('common:active')}
            inactiveLabel={t('common:inactive')}
          />
        </div>

        {/* Table Content */}
        {isLoading ? (
          <div className="py-20 flex justify-center"><Loader /></div>
        ) : controls.paged.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-base text-muted-foreground font-semibold">{t('table.empty')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Header Columns */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3.5 bg-muted/40 border-b border-border text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <span className="col-span-3">{t('table.company')}</span>
              <span className="col-span-3">{t('table.email')}</span>
              <span className="col-span-2">{t('table.cohort')}</span>
              <span className="col-span-1 text-center">{t('table.statusColumn')}</span>
              <span className="col-span-3 text-center">{t('table.actionsColumn')}</span>
            </div>

            {/* List Rows */}
            <div className="divide-y divide-border">
              {controls.paged.map((entry) => {
                const companyId = entry.status === 'active' ? Number(entry.id.replace('company-', '')) : NaN
                const { label, cls } = statusInfo(entry.status)
                return (
                  <div
                    key={entry.id}
                    className="px-6 py-4.5 hover:bg-muted/10 transition-colors"
                  >
                    {/* Desktop View */}
                    <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                      
                      {/* Name / Founder */}
                      <div className="col-span-3 flex items-center gap-3.5 min-w-0">
                        <div className="h-10 w-10 rounded-lg bg-accent text-accent-foreground flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-xs border border-border">
                          {entry.name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-base font-bold text-foreground truncate">{entry.name ?? t('table.pendingCompanyName')}</p>
                          <p className="text-sm text-muted-foreground truncate">{entry.founderName ?? '—'}</p>
                        </div>
                      </div>

                      {/* Email */}
                      <div className="col-span-3 text-sm font-medium text-muted-foreground truncate pr-2">
                        {entry.email}
                      </div>

                      {/* Cohort */}
                      <div className="col-span-2 text-sm font-semibold text-muted-foreground truncate">
                        {entry.cohortName ?? '—'}
                      </div>

                      {/* Status */}
                      <div className="col-span-1 flex justify-center">
                        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-full ${cls}`}>
                          {label}
                        </span>
                      </div>

                      {/* Action buttons with 44px min height */}
                      <div className="col-span-3 flex items-center justify-center gap-2.5">
                        {entry.status === 'active' && (
                          <>
                            {canManagePermissions(entry) && (
                              <button
                                onClick={() => openPermissionsFor(entry)}
                                className="h-11 w-11 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-xs focus:ring-2 focus:ring-ring"
                                title="Permissions"
                              >
                                <ShieldCheck className="h-5 w-5" />
                              </button>
                            )}
                            <button
                              onClick={() => navigate(`/companies/${companyId}/view-as-founder`)}
                              className="h-11 px-4 border border-border bg-card hover:bg-muted text-sm font-bold text-foreground rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs focus:ring-2 focus:ring-ring"
                            >
                              <Eye className="h-4.5 w-4.5" />
                              <span>{t('table.viewAsFounderButton')}</span>
                            </button>
                          </>
                        )}
                      </div>

                    </div>

                    {/* Mobile View */}
                    <div className="flex flex-col gap-3.5 md:hidden">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                          <div className="h-10 w-10 rounded-lg bg-accent text-accent-foreground flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-xs border border-border">
                            {entry.name?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          <div>
                            <p className="text-base font-bold text-foreground">{entry.name ?? t('table.pendingCompanyName')}</p>
                            <p className="text-sm text-muted-foreground">{entry.email}</p>
                          </div>
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cls}`}>{label}</span>
                      </div>
                      
                      {entry.status === 'active' && (
                        <div className="flex gap-2.5 mt-1">
                          {canManagePermissions(entry) && (
                            <button
                              onClick={() => openPermissionsFor(entry)}
                              className="h-11 px-4 border border-border bg-card hover:bg-muted text-sm font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                            >
                              <ShieldCheck className="h-4.5 w-4.5" />
                              <span>Permissions</span>
                            </button>
                          )}
                          <button
                            onClick={() => navigate(`/companies/${companyId}/view-as-founder`)}
                            className="h-11 px-4 bg-primary text-primary-foreground hover:bg-primary/95 text-sm font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <Eye className="h-4.5 w-4.5" />
                            <span>{t('table.viewAsFounderButton')}</span>
                          </button>
                        </div>
                      )}
                    </div>

                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-border">
          <ListPagination controls={controls} />
        </div>

      </div>

      <UserPermissionsDialog
        open={permissionsOpen}
        onOpenChange={setPermissionsOpen}
        user={permissionsUser}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['company-entries'] })}
      />

    </div>
  )
}
