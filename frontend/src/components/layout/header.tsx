import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation, Link, NavLink } from 'react-router-dom'
import { Search, X, ChevronDown, Bell, Settings, User, LogOut, ShieldCheck, Zap, Globe, Layers, BookOpen, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/auth-context'
import { useOptionalTenantSlug } from '@/context/tenant-slug-context'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getSections } from '@/lib/nav-sections'
import { ThemeToggle } from '@/components/theme-toggle'
import { LanguageSwitcher } from '@/components/language-switcher'
import { NotificationBell } from '@/components/notification-bell'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RechargeCreditsDialog } from './recharge-credits-dialog'
import type { TenantDashboardInfo } from '@/types/billing'
import type { UserRole } from '@/types/auth'

export function Header() {
  const { t } = useTranslation(['header', 'common'])
  const { t: tSidebar } = useTranslation('sidebar')
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const tenantSlug = useOptionalTenantSlug()

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [rechargeOpen, setRechargeOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch founder calendar for dynamic calendar title
  const { data: founderCalendar } = useQuery({
    queryKey: ['founder-header-calendar'],
    queryFn: async () => {
      try {
        return (await api.get<{ cohortId: number | null; cohortName: string | null }>('/api/tenants/me/founder/calendar')).data
      } catch {
        return null
      }
    },
    enabled: user?.role === 'founder',
  })

  // Dynamically resolve allowed sections for the active role/permissions
  const sections = useMemo(() => {
    return getSections(
      tSidebar,
      user?.role,
      user?.interestedInMentoring,
      founderCalendar !== undefined ? founderCalendar?.cohortName : undefined,
      user?.allowedMenus,
    )
  }, [tSidebar, user, founderCalendar])

  // Map to the NavItem structure used by the Header components
  const navItems = useMemo(() => {
    const items: { title: string; href?: string; children?: { title: string; href?: string }[] }[] = []
    sections.forEach((section) => {
      section.items.forEach((item) => {
        items.push({
          title: item.title,
          href: item.href,
          children: item.children?.map(c => ({ title: c.title, href: c.href }))
        })
      })
    })
    return items
  }, [sections])


  // 3. Searchable navigation index
  const searchableNavItems = useMemo(() => {
    const items: { title: string; href: string }[] = []
    navItems.forEach(item => {
      if (item.children) {
        item.children.forEach(child => {
          if (child.href) {
            items.push({ title: `${item.title} — ${child.title}`, href: child.href })
          }
        })
      } else if (item.href) {
        items.push({ title: item.title, href: item.href })
      }
    })
    return items
  }, [navItems])

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return searchableNavItems.filter((item) => item.title.toLowerCase().includes(q)).slice(0, 8)
  }, [query, searchableNavItems])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function handleSearchSelection(href: string) {
    navigate(href)
    setQuery('')
    setOpen(false)
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && searchResults.length > 0) {
      handleSearchSelection(searchResults[0].href)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }

  // Brand and Tenant Information
  const brandName = tenantSlug?.tenant?.name || "Accelerate OS"
  const brandLogoUrl = tenantSlug?.tenant?.logoUrl || null
  const brandInitial = brandName.trim().charAt(0).toUpperCase() || 'A'

  const { data: billingInfo } = useQuery({
    queryKey: ['tenant-dashboard-info'],
    queryFn: async () => (await api.get<TenantDashboardInfo>('/api/tenants/me/dashboard')).data,
    enabled: user?.role === 'admin',
  })


  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const roleLabels: Record<UserRole, string> = {
    founder: 'FOUNDER',
    admin: 'ADMIN',
    super_admin: 'SUPER ADMIN',
    mentor: 'MENTOR',
    funding_team: 'FOUNDING TEAM',
  }

  const initials = (name?: string | null, email?: string) => {
    if (name) return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
    return (email?.[0] ?? 'U').toUpperCase()
  }

  const renderNavItems = (heightClass: string) => {
    return sections.map((section, sIdx) => {
      const hasTitle = !!section.title

      if (hasTitle) {
        const active = section.items.some((item) => {
          if (item.href) {
            return item.href === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.href)
          }
          if (item.children) {
            return item.children.some((child) =>
              child.href
                ? (child.href === '/' ? location.pathname === '/' : location.pathname.startsWith(child.href))
                : false
            )
          }
          return false
        })

        return (
          <DropdownMenu key={section.title || sIdx}>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'relative flex items-center gap-1 px-3 text-[13px] font-semibold transition-all border-b-4 outline-none cursor-pointer',
                  heightClass,
                  active
                    ? 'text-primary border-primary bg-primary/[0.03]'
                    : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/40'
                )}
                style={{ minHeight: '44px' }}
              >
                <span>{section.title}</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-56 mt-1 max-h-[80vh] overflow-y-auto z-50">
              {section.items.map((item, itemIdx) => {
                if (item.children && item.children.length > 0) {
                  return (
                    <div key={item.title || itemIdx}>
                      {itemIdx > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuLabel className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        {item.title}
                      </DropdownMenuLabel>
                      {item.children.map((child, childIdx) => {
                        const isChildActive = child.href
                          ? (child.href === '/' ? location.pathname === '/' : location.pathname.startsWith(child.href))
                          : false
                        return (
                          <DropdownMenuItem
                            key={child.href || child.title || childIdx}
                            onClick={() => child.href && navigate(child.href)}
                            className={cn(
                              "px-4 py-2 text-[13px] font-semibold cursor-pointer",
                              isChildActive && "bg-accent text-accent-foreground"
                            )}
                          >
                            {child.title}
                          </DropdownMenuItem>
                        )
                      })}
                    </div>
                  )
                }

                const isItemActive = item.href
                  ? (item.href === '/' ? location.pathname === '/' : location.pathname.startsWith(item.href))
                  : false

                return (
                  <DropdownMenuItem
                    key={item.href || item.title || itemIdx}
                    onClick={() => item.href && navigate(item.href)}
                    className={cn(
                      "px-4 py-2 text-[13px] font-semibold cursor-pointer",
                      isItemActive && "bg-accent text-accent-foreground"
                    )}
                  >
                    {item.title}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }

      // Section without title (e.g., Overview or founder sections)
      return section.items.map((item, itemIdx) => {
        if (item.children && item.children.length > 0) {
          const active = item.children.some(child => 
            child.href ? (child.href === '/' ? location.pathname === '/' : location.pathname.startsWith(child.href)) : false
          )

          return (
            <DropdownMenu key={item.title || itemIdx}>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    'relative flex items-center gap-1 px-3 text-[13px] font-semibold transition-all border-b-4 outline-none cursor-pointer',
                    heightClass,
                    active
                      ? 'text-primary border-primary bg-primary/[0.03]'
                      : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/40'
                  )}
                  style={{ minHeight: '44px' }}
                >
                  <span>{item.title}</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-56 mt-1">
                {item.children.map((child, childIdx) => (
                  <DropdownMenuItem
                    key={child.href || child.title || childIdx}
                    onClick={() => child.href && navigate(child.href)}
                    className={cn(
                      "px-4 py-2 text-[13px] font-semibold cursor-pointer",
                      child.href && location.pathname.startsWith(child.href) && "bg-accent text-accent-foreground"
                    )}
                  >
                    {child.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }

        if (!item.href) return null

        const active = item.href === '/'
          ? location.pathname === '/'
          : location.pathname.startsWith(item.href)

        return (
          <NavLink
            key={item.title || itemIdx}
            to={item.href}
            className={cn(
              'relative flex items-center px-3 text-[13px] font-semibold transition-all border-b-4',
              heightClass,
              active
                ? 'text-primary border-primary bg-primary/[0.03]'
                : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/40'
            )}
            style={{ minHeight: '44px' }}
          >
            {item.title}
          </NavLink>
        )
      })
    })
  }

  return (
    <div className="flex flex-col flex-shrink-0 z-40 bg-card border-b border-border shadow-sm w-full max-w-full overflow-hidden">
      
      {/* ── UPPER ROW: Brand, Switcher, Role, and Right Utilities ── */}
      <div className="h-[64px] px-6 flex items-center justify-between gap-6 bg-card border-b border-border w-full max-w-full overflow-hidden">
        
        {/* Left Section: Logo & Role Badge */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-lg overflow-hidden flex-shrink-0 shadow-xs border border-border">
              {brandLogoUrl ? (
                <img src={brandLogoUrl} alt={brandName} className="h-full w-full object-contain bg-white" />
              ) : (
                brandInitial
              )}
            </div>
            <span className="font-bold text-lg text-foreground tracking-tight hidden md:block">
              {brandName}
            </span>
          </Link>

          {/* Role Badge */}
          <span className="inline-flex items-center px-2.5 py-1 mr-2 rounded-md bg-primary text-primary-foreground text-xs font-bold tracking-wider shadow-xs hidden lg:inline-flex">
            {user?.role ? roleLabels[user.role] : 'ADMIN'}
          </span>
        </div>


        {/* Right Section: Search, Lang, Theme, Notification, Credits, Profile */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 lg:gap-4.5 flex-shrink-0">
          
          {/* Global Search Input */}
          <div ref={containerRef} className="relative hidden xl:block w-[200px] sm:w-[240px] md:w-[280px] lg:w-[320px] xl:w-[380px]">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                placeholder={t('common:search')}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
                onFocus={() => query && setOpen(true)}
                onKeyDown={handleSearchKeyDown}
                className="h-10 w-full pl-9 pr-9 text-sm border border-border bg-muted/40 rounded-lg text-foreground placeholder:text-muted-foreground/50 outline-none transition-all focus:border-primary focus:bg-background focus:ring-2 focus:ring-ring"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(''); setOpen(false) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Search Dropdown */}
            {open && query.trim() && (
              <div className="absolute right-0 top-full mt-1.5 w-[280px] rounded-lg border border-border bg-popover shadow-lg z-50 overflow-hidden">
                {searchResults.length > 0 ? (
                  searchResults.map((item) => (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => handleSearchSelection(item.href)}
                      className="w-full text-left px-4 py-3 text-sm font-semibold text-foreground hover:bg-accent hover:text-accent-foreground transition-colors border-b border-border last:border-b-0"
                    >
                      {item.title}
                    </button>
                  ))
                ) : (
                  <p className="px-4 py-3.5 text-sm text-muted-foreground">
                    {t('header:noPagesFound', { query })}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Credits/Plan Badge */}
          <div className="hidden lg:flex items-center gap-3 px-3 py-1 bg-background/60 backdrop-blur-md border border-border/80 shadow-xs hover:shadow-sm rounded-lg text-sm font-medium text-foreground h-10 transition-all select-none">
            <div className="relative flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary">
              <Zap className="h-3.5 w-3.5 fill-primary/20 animate-pulse" />
            </div>
            <div className="flex flex-col justify-center min-w-0">
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold leading-none mb-0.5">AI Usage</span>
              <span className="text-xs font-semibold text-foreground leading-none whitespace-nowrap">
                {billingInfo?.aiCreditsBalance ?? 56} credits
              </span>
            </div>
            <button
              onClick={() => setRechargeOpen(true)}
              className="ml-1 h-7 px-2.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold rounded-md transition-all shadow-xs active:translate-y-px cursor-pointer whitespace-nowrap flex items-center justify-center gap-1 uppercase tracking-wide"
            >
              Recharge
            </button>
          </div>

          <NotificationBell />
          <LanguageSwitcher className="h-10 px-3.5 gap-2 text-xs font-semibold" />
          <ThemeToggle className="h-10 w-10" />

          {/* User Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-2.5 ml-2 mr-[100px] border border-border bg-muted/30 hover:bg-muted/60 transition-colors rounded-lg focus:outline-none cursor-pointer h-9">
                <Avatar className="h-7 w-7 flex-shrink-0">
                  <AvatarFallback className="text-[9px] font-bold bg-primary text-white">
                    {initials(user?.name, user?.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left hidden lg:block min-w-0">
                  <p className="text-xs font-bold text-foreground leading-tight truncate max-w-[120px]">{user?.name || 'Jeff Bezos'}</p>
                  <p className="text-[10px] text-muted-foreground leading-none whitespace-nowrap">{user?.role ? roleLabels[user.role] : 'Admin'}</p>
                </div>
                <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 mt-1">
              <DropdownMenuLabel className="font-normal px-3 py-2">
                <p className="text-sm font-bold text-foreground truncate">{user?.name || 'Jeff Bezos'}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/profile')} className="gap-2 text-sm font-semibold cursor-pointer">
                <User className="h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/settings')} className="gap-2 text-sm font-semibold cursor-pointer">
                <Settings className="h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="gap-2 text-sm font-semibold text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer">
                <LogOut className="h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

        </div>
      </div>

      {/* ── LOWER ROW: Full-Width Primary Navigation Links ── */}
      <div className="h-[48px] px-6 bg-card flex justify-center border-t border-border">
        <nav className="flex items-center gap-2 h-full overflow-hidden">
          {renderNavItems('h-[48px]')}
        </nav>
      </div>

      {/* Recharge Credits Dialog */}
      <RechargeCreditsDialog
        open={rechargeOpen}
        onOpenChange={setRechargeOpen}
        plan={billingInfo?.plan ?? null}
      />
    </div>
  )
}
