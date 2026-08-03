import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LogOut, User, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/auth-context'
import { useOptionalTenantSlug } from '@/context/tenant-slug-context'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { PlanCreditsWidget } from '@/components/layout/plan-credits-widget'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { UserRole } from '@/types/auth'
import { getSections, founderSections, hasActiveDescendant, firstHref, type NavChild, type NavItem, type NavSection } from '@/lib/nav-sections'

function prefixHref(href: string | undefined, basePath: string): string | undefined {
  if (!href) return href
  return href === '/' ? basePath : `${basePath}${href}`
}

function prefixChildren(children: NavChild[], basePath: string): NavChild[] {
  return children.map((c) => ({
    ...c,
    href: prefixHref(c.href, basePath),
    children: c.children ? prefixChildren(c.children, basePath) : undefined,
  }))
}

function prefixSections(sections: NavSection[], basePath: string): NavSection[] {
  return sections.map((s) => ({
    ...s,
    items: s.items.map((item) => ({
      ...item,
      href: prefixHref(item.href, basePath),
      children: item.children ? prefixChildren(item.children, basePath) : undefined,
    })),
  }))
}

function initials(name?: string | null, email?: string) {
  if (name) return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
  return (email?.[0] ?? 'U').toUpperCase()
}

function NavChildRow({ child }: { child: NavChild }) {
  const location = useLocation()
  const [manuallyToggled, setManuallyToggled] = useState<boolean | null>(null)

  if (!child.children) {
    return (
      <NavLink
        to={child.href!}
        className={({ isActive }) =>
          cn(
            'flex items-center px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-150 ml-1',
            isActive
              ? 'bg-accent text-accent-foreground font-semibold'
              : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
          )
        }
      >
        {child.title}
      </NavLink>
    )
  }

  const childActive = hasActiveDescendant(child.children, location.pathname)
  const open = manuallyToggled ?? childActive

  return (
    <div>
      <div className="flex items-center rounded-md text-[13px] font-medium transition-all duration-150">
        {child.href ? (
          <NavLink
            to={child.href}
            end
            className={({ isActive }) =>
              cn(
                'flex-1 px-3 py-1.5 rounded-md ml-1',
                isActive
                  ? 'bg-accent text-accent-foreground font-semibold'
                  : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
              )
            }
          >
            {child.title}
          </NavLink>
        ) : (
          <button
            type="button"
            onClick={() => setManuallyToggled(!open)}
            className={cn(
              'flex-1 text-left px-3 py-1.5 rounded-md ml-1',
              childActive
                ? 'text-sidebar-foreground font-semibold'
                : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
            )}
          >
            {child.title}
          </button>
        )}
        <button
          type="button"
          onClick={() => setManuallyToggled(!open)}
          className="px-2 py-1.5 text-sidebar-foreground/30 hover:text-sidebar-foreground/70"
        >
          <ChevronDown className={cn('h-3 w-3 flex-shrink-0 transition-transform duration-200', open && 'rotate-180')} />
        </button>
      </div>
      {open && (
        <div className="ml-4 pl-2.5 border-l border-sidebar-border space-y-0.5 mt-0.5">
          {child.children.map((grandchild) => (
            <NavChildRow key={grandchild.title} child={grandchild} />
          ))}
        </div>
      )}
    </div>
  )
}

function NavItemRow({ item, collapsed, rootPath }: { item: NavItem; collapsed: boolean; rootPath: string }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [manuallyToggled, setManuallyToggled] = useState<boolean | null>(null)

  if (!item.children || item.children.length === 0) {
    return (
      <NavLink
        to={item.href!}
        end={item.href === rootPath}
        title={collapsed ? item.title : undefined}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-3 px-3 py-2 rounded-md text-[13.5px] font-medium transition-all duration-150',
            collapsed && 'justify-center px-2',
            isActive
              ? 'bg-accent text-accent-foreground font-semibold shadow-sm'
              : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
          )
        }
      >
        <item.icon className={cn('flex-shrink-0', collapsed ? 'h-5 w-5' : 'h-4 w-4')} />
        {!collapsed && <span className="truncate">{item.title}</span>}
      </NavLink>
    )
  }

  const childActive = hasActiveDescendant(item.children, location.pathname)
  const isSelfActive = item.href
    ? (location.pathname === item.href || (item.href !== rootPath && location.pathname.startsWith(`${item.href}/`)))
    : false
  const open = manuallyToggled ?? (childActive || isSelfActive)

  return (
    <div>
      <div className="flex items-center rounded-md text-[13.5px] font-medium transition-all duration-150">
        {item.href ? (
          <NavLink
            to={item.href}
            end={item.href === rootPath}
            title={collapsed ? item.title : undefined}
            className={({ isActive }) =>
              cn(
                'flex-1 flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-150',
                collapsed && 'justify-center px-2',
                isActive || childActive
                  ? 'bg-accent text-accent-foreground font-semibold shadow-sm'
                  : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
              )
            }
          >
            <item.icon className={cn('flex-shrink-0', collapsed ? 'h-5 w-5' : 'h-4 w-4')} />
            {!collapsed && <span className="flex-1 text-left truncate">{item.title}</span>}
          </NavLink>
        ) : (
          <button
            type="button"
            title={collapsed ? item.title : undefined}
            onClick={() => {
              if (collapsed) { navigate(firstHref(item.children!)); return }
              setManuallyToggled(!open)
            }}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-150',
              collapsed && 'justify-center px-2',
              childActive
                ? 'text-sidebar-foreground font-semibold'
                : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
            )}
          >
            <item.icon className={cn('flex-shrink-0', collapsed ? 'h-5 w-5' : 'h-4 w-4')} />
            {!collapsed && <span className="flex-1 text-left truncate">{item.title}</span>}
          </button>
        )}
        {!collapsed && (
          <button
            type="button"
            onClick={() => setManuallyToggled(!open)}
            className="px-2 py-2 text-sidebar-foreground/30 hover:text-sidebar-foreground/70 rounded-r-md"
          >
            <ChevronDown className={cn('h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200', open && 'rotate-180')} />
          </button>
        )}
      </div>
      {!collapsed && open && (
        <div className="ml-4 pl-2.5 border-l border-sidebar-border space-y-0.5 mt-0.5">
          {item.children.map((child) => (
            <NavChildRow key={child.title} child={child} />
          ))}
        </div>
      )}
    </div>
  )
}

interface SidebarProps {
  collapsed: boolean
  forceFounderView?: boolean
  previewBasePath?: string
}

export function Sidebar({ collapsed, forceFounderView, previewBasePath }: SidebarProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation(['sidebar', 'common'])

  const { data: founderCalendar } = useQuery({
    queryKey: ['founder-sidebar-calendar'],
    queryFn: async () => {
      try {
        return (await api.get<{ cohortId: number | null; cohortName: string | null }>('/api/tenants/me/founder/calendar')).data
      } catch {
        return null
      }
    },
    enabled: user?.role === 'founder',
  })

  const sections = forceFounderView
    ? prefixSections(founderSections(t), previewBasePath ?? '')
    : getSections(
        t,
        user?.role,
        user?.interestedInMentoring,
        founderCalendar !== undefined ? founderCalendar?.cohortName : undefined,
        user?.allowedMenus,
      )

  const tenantSlug = useOptionalTenantSlug()
  const brandName = tenantSlug?.tenant?.name || t('common:brand')
  const brandLogoUrl = tenantSlug?.tenant?.logoUrl || null
  const brandInitial = brandName.trim().charAt(0).toUpperCase() || 'A'

  const roleLabels: Record<UserRole, string> = {
    founder: t('roleLabels.founder'),
    admin: t('roleLabels.admin'),
    super_admin: t('roleLabels.super_admin'),
    mentor: t('roleLabels.mentor'),
    funding_team: t('roleLabels.funding_team'),
  }

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <aside
      data-theme-chrome
      className={cn(
        'relative z-10 flex flex-col h-screen bg-sidebar border-r border-sidebar-border flex-shrink-0 transition-all duration-200',
        collapsed ? 'w-[60px]' : 'w-[240px]',
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          'flex items-center h-[60px] border-b border-sidebar-border flex-shrink-0 px-4',
          collapsed ? 'justify-center px-2' : 'gap-3',
        )}
      >
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center font-bold text-sm overflow-hidden rounded-lg',
            collapsed ? 'h-8 w-8' : 'h-8 w-8',
            brandLogoUrl
              ? 'bg-sidebar-accent border border-sidebar-border'
              : 'bg-gradient-accent text-white',
          )}
        >
          {brandLogoUrl
            ? <img src={brandLogoUrl} alt={brandName} className="h-full w-full object-contain" />
            : brandInitial}
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-semibold text-sm text-sidebar-foreground truncate leading-tight">{brandName}</p>
            <p className="text-[11px] text-sidebar-foreground/45 leading-tight">Workspace</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {sections.map((section, si) => (
          <div key={si} className={si > 0 ? 'mt-4' : ''}>
            {section.title && !collapsed && (
              <p className="px-3 pt-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-sidebar-foreground/35">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavItemRow
                  key={item.title}
                  item={item}
                  collapsed={collapsed}
                  rootPath={forceFounderView ? (previewBasePath ?? '/') : '/'}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {!collapsed && !forceFounderView && user?.role === 'admin' && <PlanCreditsWidget />}

      {/* User footer */}
      <div className="border-t border-sidebar-border p-2 flex-shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'w-full flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-sidebar-accent/60 transition-colors text-left',
                collapsed && 'justify-center',
              )}
            >
              <Avatar className="h-7 w-7 flex-shrink-0">
                <AvatarFallback className="text-[11px] font-semibold bg-gradient-accent text-white">
                  {initials(user?.name, user?.email)}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate leading-tight text-sidebar-foreground">
                      {user?.name || user?.email?.split('@')[0] || 'User'}
                    </p>
                    <p className="text-[11px] text-sidebar-foreground/45 leading-tight">
                      {user?.role ? roleLabels[user.role] : ''}
                    </p>
                  </div>
                  <ChevronRight className="h-3 w-3 text-sidebar-foreground/25 flex-shrink-0" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align={collapsed ? 'center' : 'start'}
            className="w-56 bg-popover border border-border shadow-lg"
          >
            <DropdownMenuLabel className="font-normal px-3 py-2">
              <p className="text-sm font-semibold text-foreground">{user?.name || 'User'}</p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => navigate('/profile')}
              className="gap-2 text-sm cursor-pointer"
            >
              <User className="h-4 w-4" />
              {t('profile')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="gap-2 text-sm text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              {t('common:signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
