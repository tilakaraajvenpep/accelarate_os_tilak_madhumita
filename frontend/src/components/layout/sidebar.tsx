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
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/auth-context'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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

const FOUNDER_SECTIONS: NavSection[] = [
  {
    items: [
      { href: '/app', icon: Home, title: 'Overview' },
      { href: '/app/pillars', icon: LayoutDashboard, title: 'My Pillars' },
      { href: '/app/documents', icon: FileText, title: 'Documents' },
      { href: '/app/calendar', icon: Calendar, title: 'Calendar' },
      { href: '/app/messages', icon: MessageSquare, title: 'Messages' },
    ],
  },
]

const ADMIN_SECTIONS: NavSection[] = [
  {
    items: [{ href: '/app', icon: Home, title: 'Overview' }],
  },
  {
    title: 'Management',
    items: [
      { href: '/app/cohorts', icon: Users, title: 'Cohorts' },
      { href: '/app/companies', icon: Building2, title: 'Companies' },
      { href: '/app/programs', icon: BookOpen, title: 'Programs' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { href: '/app/scoring', icon: BarChart2, title: 'Scoring' },
      { href: '/app/documents', icon: FileText, title: 'Documents' },
      { href: '/app/calendar', icon: Calendar, title: 'Calendar' },
    ],
  },
  {
    title: 'Settings',
    items: [{ href: '/app/admin/email-templates', icon: Mail, title: 'Email Templates' }],
  },
]

const SUPER_ADMIN_SECTIONS: NavSection[] = [
  {
    items: [{ href: '/app', icon: Globe, title: 'Platform Overview' }],
  },
  {
    title: 'Platform',
    items: [
      { href: '/app/admin/tenants', icon: Building2, title: 'Tenants' },
      { href: '/app/superadmin/plans', icon: CreditCard, title: 'Plans & Billing' },
      { href: '/app/superadmin/reports', icon: BarChart2, title: 'Reports' },
      { href: '/app/superadmin/settings', icon: Settings, title: 'Settings' },
    ],
  },
]

const MENTOR_SECTIONS: NavSection[] = [
  {
    items: [
      { href: '/app', icon: Home, title: 'Overview' },
      { href: '/app/companies', icon: Building2, title: 'My Companies' },
      { href: '/app/calendar', icon: Calendar, title: 'Calendar' },
      { href: '/app/documents', icon: FileText, title: 'Documents' },
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

const ROLE_LABELS: Record<UserRole, string> = {
  founder: 'Founder',
  admin: 'Admin',
  super_admin: 'Super Admin',
  mentor: 'Mentor',
  funding_team: 'Funding Team',
}

interface SidebarProps {
  collapsed: boolean
}

export function Sidebar({ collapsed }: SidebarProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const sections = getSections(user?.role)

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
        {!collapsed && <span className="font-semibold text-sm text-ink">AccelerateOS</span>}
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
                end={item.href === '/app'}
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
                      {user?.role ? ROLE_LABELS[user.role] : ''}
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
            <DropdownMenuItem onClick={() => navigate('/app/settings')} className="focus:bg-glass-2 focus:text-ink">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-glass-2" />
            <DropdownMenuItem onClick={handleLogout} className="text-red-400 focus:text-red-400 focus:bg-red-400/10">
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
