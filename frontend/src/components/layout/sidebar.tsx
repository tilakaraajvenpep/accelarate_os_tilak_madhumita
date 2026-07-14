import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
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
  ChevronRight,
  UserPlus,
  KeyRound,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/auth-context'
import { useTranslation } from '@/i18n/I18nProvider'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChangePasswordDialog } from './change-password-dialog'
import type { UserRole } from '@/types/auth'

type NavItem = {
  href: string
  icon: LucideIcon
  titleKey: string
}

type NavSection = {
  titleKey?: string
  items: NavItem[]
}

const FOUNDER_SECTIONS: NavSection[] = [
  {
    items: [
      { href: '/app', icon: Home, titleKey: 'nav.overview' },
      { href: '/app/pillars', icon: LayoutDashboard, titleKey: 'nav.myPillars' },
      { href: '/app/documents', icon: FileText, titleKey: 'nav.documents' },
      { href: '/app/calendar', icon: Calendar, titleKey: 'nav.calendar' },
      { href: '/app/messages', icon: MessageSquare, titleKey: 'nav.messages' },
    ],
  },
]

const ADMIN_SECTIONS: NavSection[] = [
  {
    items: [{ href: '/app', icon: Home, titleKey: 'nav.overview' }],
  },
  {
    titleKey: 'nav.management',
    items: [
      { href: '/app/cohorts', icon: Users, titleKey: 'nav.cohorts' },
      { href: '/app/companies', icon: Building2, titleKey: 'nav.companies' },
      { href: '/app/programs', icon: BookOpen, titleKey: 'nav.programs' },
    ],
  },
  {
    titleKey: 'nav.tools',
    items: [
      { href: '/app/scoring', icon: BarChart2, titleKey: 'nav.scoring' },
      { href: '/app/documents', icon: FileText, titleKey: 'nav.documents' },
      { href: '/app/calendar', icon: Calendar, titleKey: 'nav.calendar' },
    ],
  },
  {
    titleKey: 'nav.settings',
    items: [{ href: '/app/admin/email-templates', icon: Mail, titleKey: 'nav.emailTemplates' }],
  },
]

const SUPER_ADMIN_SECTIONS: NavSection[] = [
  {
    items: [{ href: '/app', icon: Globe, titleKey: 'nav.platformOverview' }],
  },
  {
    titleKey: 'nav.platform',
    items: [
      { href: '/app/admin/tenants', icon: Building2, titleKey: 'nav.tenants' },
      { href: '/app/superadmin/plans', icon: CreditCard, titleKey: 'nav.plansBilling' },
      { href: '/app/superadmin/admins', icon: UserPlus, titleKey: 'nav.superAdmins' },
      { href: '/app/superadmin/reports', icon: BarChart2, titleKey: 'nav.reports' },
      { href: '/app/superadmin/settings', icon: Settings, titleKey: 'nav.settings' },
    ],
  },
]

const MENTOR_SECTIONS: NavSection[] = [
  {
    items: [
      { href: '/app', icon: Home, titleKey: 'nav.overview' },
      { href: '/app/companies', icon: Building2, titleKey: 'nav.myCompanies' },
      { href: '/app/calendar', icon: Calendar, titleKey: 'nav.calendar' },
      { href: '/app/documents', icon: FileText, titleKey: 'nav.documents' },
    ],
  },
]

function getSections(role?: UserRole): NavSection[] {
  switch (role) {
    case 'super_admin': return SUPER_ADMIN_SECTIONS
    case 'admin': return ADMIN_SECTIONS
    case 'mentor': return MENTOR_SECTIONS
    default: return FOUNDER_SECTIONS
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
  const { t } = useTranslation()
  const sections = getSections(user?.role)
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
        {!collapsed && <span className="font-semibold text-sm text-ink">{t('common.brand')}</span>}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {sections.map((section, si) => (
          <div key={si}>
            {section.titleKey && !collapsed && (
              <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink/25">
                {t(section.titleKey)}
              </p>
            )}
            {section.items.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.href === '/app'}
                title={collapsed ? t(item.titleKey) : undefined}
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
                {!collapsed && <span>{t(item.titleKey)}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

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
                      {user?.name || user?.email?.split('@')[0] || t('sidebar.user')}
                    </p>
                    <p className="text-xs text-ink/35 leading-tight">
                      {user?.role ? t(`role.${user.role}`) : ''}
                    </p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-ink/25 flex-shrink-0" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align={collapsed ? 'center' : 'start'} className="w-56 bg-popover border-glass-border text-ink/80">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium text-ink">{user?.name || t('sidebar.user')}</p>
              <p className="text-xs text-ink/40 truncate">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-glass-2" />
            <DropdownMenuItem onClick={() => navigate('/app/settings')} className="focus:bg-glass-2 focus:text-ink">
              <Settings className="h-4 w-4 mr-2" />
              {t('nav.settings')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setChangePasswordOpen(true)} className="focus:bg-glass-2 focus:text-ink">
              <KeyRound className="h-4 w-4 mr-2" />
              {t('sidebar.changePassword.menuItem')}
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-glass-2" />
            <DropdownMenuItem onClick={handleLogout} className="text-red-400 focus:text-red-400 focus:bg-red-400/10">
              <LogOut className="h-4 w-4 mr-2" />
              {t('sidebar.signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </aside>
  )
}
