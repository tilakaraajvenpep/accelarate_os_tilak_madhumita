import { createContext, useContext, type ReactNode } from 'react'

export interface ViewAsCompanyValue {
  companyId: number
  companyName: string | null
  founderName: string | null
}

const ViewAsCompanyContext = createContext<ViewAsCompanyValue | null>(null)

export function ViewAsCompanyProvider({ value, children }: { value: ViewAsCompanyValue; children: ReactNode }) {
  return <ViewAsCompanyContext.Provider value={value}>{children}</ViewAsCompanyContext.Provider>
}

/** Non-null only when an admin is browsing a founder's pages read-only via "View as founder" — every founder
 * page checks this to swap its own `/founder/...` endpoints for the matching `/companies/:id/view-as/...` ones
 * and to hide write actions (fill/submit, invite, upload, delete). */
export function useViewAsCompany() {
  return useContext(ViewAsCompanyContext)
}
