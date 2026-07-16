import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  Home,
  LayoutDashboard,
  Users,
  Building2,
  BookOpen,
  BarChart2,
  FileText,
  Calendar,
  Mail,
  Settings,
  LogOut,
  Globe,
  CreditCard,
  MessageSquare,
  ShieldCheck,
  Ticket,
  KeyRound,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/auth-context'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ChangePasswordDialog } from '@/components/change-password-dialog'
import { PlanCreditsWidget } from '@/components/layout/plan-credits-widget'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { UserRole } from '@/types/auth'

type NavItem = {
  href: string
  icon: LucideIcon
  title: string
}

type NavSection = {
  title?: string
  items: NavItem[]
}

function founderSections(t: TFunction<'sidebar'>): NavSection[] {
  return [
    {
      items: [
        { href: '/', icon: Home, title: t('nav.overview') },
        { href: '/pillars', icon: LayoutDashboard, title: t('nav.myPillars') },
        { href: '/documents', icon: FileText, title: t('nav.documents') },
        { href: '/calendar', icon: Calendar, title: t('nav.calendar') },
        { href: '/messages', icon: MessageSquare, title: t('nav.messages') },
      ],
    },
  ]
}

function adminSections(t: TFunction<'sidebar'>): NavSection[] {
  return [
    {
      items: [{ href: '/', icon: Home, title: t('nav.overview') }],
    },
    {
      title: t('sections.management'),
      items: [
        { href: '/cohorts', icon: Users, title: t('nav.cohorts') },
        { href: '/companies', icon: Building2, title: t('nav.companies') },
        { href: '/programs', icon: BookOpen, title: t('nav.programs') },
      ],
    },
    {
      title: t('sections.tools'),
      items: [
        { href: '/scoring', icon: BarChart2, title: t('nav.scoring') },
        { href: '/documents', icon: FileText, title: t('nav.documents') },
        { href: '/calendar', icon: Calendar, title: t('nav.calendar') },
      ],
    },
    {
      title: t('nav.settings'),
      items: [{ href: '/admin/email-templates', icon: Mail, title: t('nav.emailTemplates') }],
    },
  ]
}

function superAdminSections(t: TFunction<'sidebar'>): NavSection[] {
  return [
    {
      items: [{ href: '/', icon: Globe, title: t('nav.platformOverview') }],
    },
    {
      title: t('sections.platform'),
      items: [
        { href: '/superadmin/tenants', icon: Building2, title: t('nav.tenants') },
        { href: '/superadmin/admins', icon: ShieldCheck, title: t('nav.superAdmins') },
        { href: '/superadmin/plans', icon: CreditCard, title: t('nav.plansBilling') },
        { href: '/superadmin/coupons', icon: Ticket, title: t('nav.coupons') },
        { href: '/superadmin/reports', icon: BarChart2, title: t('nav.reports') },
        { href: '/superadmin/settings', icon: Settings, title: t('nav.settings') },
      ],
    },
  ]
}

function mentorSections(t: TFunction<'sidebar'>): NavSection[] {
  return [
    {
      items: [
        { href: '/', icon: Home, title: t('nav.overview') },
        { href: '/companies', icon: Building2, title: t('nav.myCompanies') },
        { href: '/calendar', icon: Calendar, title: t('nav.calendar') },
        { href: '/documents', icon: FileText, title: t('nav.documents') },
      ],
    },
  ]
}

function getSections(t: TFunction<'sidebar'>, role?: UserRole): NavSection[] {
  switch (role) {
    case 'super_admin': return superAdminSections(t)
    case 'admin': return adminSections(t)
    case 'mentor': return mentorSections(t)
    default: return founderSections(t)
  }
}

function initials(name?: string | null, email?: string) {
  if (name) return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
  return (email?.[0] ?? 'U').toUpperCase()
}

interface SidebarProps {
  collapsed: boolean
}

export function Sidebar({ collapsed }: SidebarProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation(['sidebar', 'common'])
  const sections = getSections(t, user?.role)
  const roleLabels: Record<UserRole, string> = {
    founder: t('roleLabels.founder'),
    admin: t('roleLabels.admin'),
    super_admin: t('roleLabels.super_admin'),
    mentor: t('roleLabels.mentor'),
    funding_team: t('roleLabels.funding_team'),
  }
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <aside
      className={cn(
        'relative z-10 flex flex-col h-screen border-r border-glass-border bg-glass backdrop-blur-xl flex-shrink-0 transition-all duration-200',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Brand */}
      <div className={cn('flex items-center h-14 border-b border-glass-border flex-shrink-0', collapsed ? 'justify-center px-2' : 'px-4 gap-3')}>
        <div className="h-8 w-8 flex-shrink-0 rounded-lg bg-glass-2 border border-glass-border flex items-center justify-center text-ink font-bold text-sm">
          A
        </div>
        {!collapsed && <span className="font-semibold text-sm text-ink">{t('common:brand')}</span>}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {sections.map((section, si) => (
          <div key={si}>
            {section.title && !collapsed && (
              <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink/25">
                {section.title}
              </p>
            )}
            {section.items.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.href === '/'}
                title={collapsed ? item.title : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                    collapsed && 'justify-center',
                    isActive
                      ? 'bg-glass-2 text-ink border border-glass-border'
                      : 'text-ink/40 hover:bg-glass-2 hover:text-ink/70',
                  )
                }
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && <span>{item.title}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {!collapsed && user?.role === 'admin' && <PlanCreditsWidget />}

      {/* User footer */}
      <div className="border-t border-glass-border p-2 flex-shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-glass-2 transition-colors text-left',
                collapsed && 'justify-center px-2',
              )}
            >
              <Avatar className="h-7 w-7 flex-shrink-0">
                <AvatarFallback className="text-xs bg-glass-2 text-ink/70 font-semibold">
                  {initials(user?.name, user?.email)}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate leading-tight text-ink/80">
                      {user?.name || user?.email?.split('@')[0] || 'User'}
                    </p>
                    <p className="text-xs text-ink/35 leading-tight">
                      {user?.role ? roleLabels[user.role] : ''}
                    </p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-ink/25 flex-shrink-0" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align={collapsed ? 'center' : 'start'} className="w-56 bg-popover border-glass-border text-ink/80">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium text-ink">{user?.name || 'User'}</p>
              <p className="text-xs text-ink/40 truncate">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-glass-2" />
            <DropdownMenuItem onClick={() => navigate('/settings')} className="focus:bg-glass-2 focus:text-ink">
              <Settings className="h-4 w-4 mr-2" />
              {t('common:settings')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setChangePasswordOpen(true)} className="focus:bg-glass-2 focus:text-ink">
              <KeyRound className="h-4 w-4 mr-2" />
              {t('changePassword')}
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-glass-2" />
            <DropdownMenuItem onClick={handleLogout} className="text-red-400 focus:text-red-400 focus:bg-red-400/10">
              <LogOut className="h-4 w-4 mr-2" />
              {t('common:signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </aside>
  )
}
