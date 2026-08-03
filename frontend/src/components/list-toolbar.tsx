import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ListControls, PageSize, StatusFilter } from '@/hooks/use-list-controls'

const PAGE_SIZE_OPTIONS: PageSize[] = [10, 25, 50, 100, 'all']

/** Search box + optional active/inactive filter + page-size picker, for the top of any list/table view. */
export function ListToolbar<T>({
  controls,
  searchPlaceholder,
  activeLabel,
  inactiveLabel,
  extraFilters,
}: {
  controls: ListControls<T>
  searchPlaceholder?: string
  activeLabel?: string
  inactiveLabel?: string
  /** Extra filter dropdowns (e.g. plan, richer status) rendered inline between the built-in status filter and the page-size picker. */
  extraFilters?: ReactNode
}) {
  const { t } = useTranslation('common')
  const resolvedSearchPlaceholder = searchPlaceholder ?? t('search')
  const resolvedActiveLabel = activeLabel ?? t('active')
  const resolvedInactiveLabel = inactiveLabel ?? t('inactive')

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex-1 min-w-[180px] space-y-1">
        <label className="text-xs text-muted-foreground">{t('search')}</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 z-10 h-4 w-4" style={{ color: '#000000' }} />
          <Input className="pl-9 backdrop-blur-none" placeholder={resolvedSearchPlaceholder} value={controls.search} onChange={(e) => controls.setSearch(e.target.value)} />
        </div>
      </div>

      {controls.hasStatusFilter && (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t('status')}</label>
          <Select value={controls.status} onValueChange={(v) => v && controls.setStatus(v as StatusFilter)}>
            <SelectTrigger className="w-36">
              <Filter className="h-3.5 w-3.5 shrink-0" style={{ color: '#000000' }} />
              <SelectValue>
                {(v: string) => (v === 'all' ? t('listToolbar.allStatuses') : v === 'active' ? resolvedActiveLabel : resolvedInactiveLabel)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('listToolbar.allStatuses')}</SelectItem>
              <SelectItem value="active">{resolvedActiveLabel}</SelectItem>
              <SelectItem value="inactive">{resolvedInactiveLabel}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {extraFilters}

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">{t('listToolbar.rowsPerPage')}</label>
        <Select value={String(controls.pageSize)} onValueChange={(v) => v && controls.setPageSize((v === 'all' ? 'all' : Number(v)) as PageSize)}>
          <SelectTrigger className="w-32">
            <SelectValue>{(v: string) => (v === 'all' ? t('listToolbar.showAll') : t('listToolbar.pageSize', { size: v }))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size === 'all' ? t('listToolbar.showAll') : t('listToolbar.pageSize', { size })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

/** Prev/Next + "X–Y of N" footer, paired with useListControls. Renders nothing when everything fits on one page. */
export function ListPagination<T>({ controls }: { controls: ListControls<T> }) {
  const { t } = useTranslation('common')
  if (controls.pageSize === 'all' || controls.totalCount === 0 || controls.pageCount <= 1) return null

  const start = (controls.page - 1) * controls.pageSize + 1
  const end = Math.min(controls.page * controls.pageSize, controls.totalCount)

  return (
    <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
      <span>{t('listToolbar.rangeOfTotal', { start, end, total: controls.totalCount })}</span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" disabled={controls.page <= 1} onClick={() => controls.setPage(controls.page - 1)}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="px-2 text-xs">{t('listToolbar.pageOfTotal', { page: controls.page, total: controls.pageCount })}</span>
        <Button variant="outline" size="icon-sm" disabled={controls.page >= controls.pageCount} onClick={() => controls.setPage(controls.page + 1)}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
