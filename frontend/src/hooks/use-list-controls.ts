import { useMemo, useState } from 'react'

export type StatusFilter = 'all' | 'active' | 'inactive'
export type PageSize = 10 | 25 | 50 | 100 | 'all'

interface UseListControlsOptions<T> {
  /** Strings to match the search query against (case-insensitive substring match on any of them). */
  searchFields: (item: T) => (string | null | undefined)[]
  /** Returns true for "active" — omit entirely to skip the status filter for this list. */
  statusValue?: (item: T) => boolean
  initialPageSize?: PageSize
}

/** Client-side search + active/inactive filter + page-size control, shared by every list/table view. */
export function useListControls<T>(items: T[], options: UseListControlsOptions<T>) {
  const [search, setSearchRaw] = useState('')
  const [status, setStatusRaw] = useState<StatusFilter>('all')
  const [pageSize, setPageSizeRaw] = useState<PageSize>(options.initialPageSize ?? 25)
  const [page, setPage] = useState(1)

  function setSearch(v: string) {
    setSearchRaw(v)
    setPage(1)
  }
  function setStatus(v: StatusFilter) {
    setStatusRaw(v)
    setPage(1)
  }
  function setPageSize(v: PageSize) {
    setPageSizeRaw(v)
    setPage(1)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => {
      if (q && !options.searchFields(item).some((f) => (f ?? '').toLowerCase().includes(q))) return false
      if (options.statusValue && status !== 'all') {
        const active = options.statusValue(item)
        if (status === 'active' && !active) return false
        if (status === 'inactive' && active) return false
      }
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search, status])

  const totalCount = filtered.length
  const pageCount = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(totalCount / pageSize))
  const safePage = Math.min(page, pageCount)

  const paged = useMemo(() => {
    if (pageSize === 'all') return filtered
    const start = (safePage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, pageSize, safePage])

  return {
    search,
    setSearch,
    status,
    setStatus,
    pageSize,
    setPageSize,
    page: safePage,
    setPage,
    pageCount,
    totalCount,
    filtered,
    paged,
    hasStatusFilter: !!options.statusValue,
  }
}

export type ListControls<T> = ReturnType<typeof useListControls<T>>
