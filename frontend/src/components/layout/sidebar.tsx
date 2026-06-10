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
      { href: '/', icon: Home, title: 'Overview' },
      { href: '/pillars', icon: LayoutDashboard, title: 'My Pillars' },
      { href: '/documents', icon: FileText, title: 'Documents' },
      { href: '/calendar', icon: Calendar, title: 'Calendar' },
      { href: '/messages', icon: MessageSquare, title: 'Messages' },
    ],
  },
]

const ADMIN_SECTIONS: NavSection[] = [
  {
    items: [{ href: '/', icon: Home, title: 'Overview' }],
  },
  {
    title: 'Management',
    items: [
      { href: '/cohorts', icon: Users, title: 'Cohorts' },
      { href: '/companies', icon: Building2, title: 'Companies' },
      { href: '/programs', icon: BookOpen, title: 'Programs' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { href: '/scoring', icon: BarChart2, title: 'Scoring' },
      { href: '/documents', icon: FileText, title: 'Documents' },
      { href: '/calendar', icon: Calendar, title: 'Calendar' },
    ],
  },
  {
    title: 'Settings',
    items: [{ href: '/admin/email-templates', icon: Mail, title: 'Email Templates' }],
  },
]

const SUPER_ADMIN_SECTIONS: NavSection[] = [
  {
    items: [{ href: '/', icon: Globe, title: 'Platform Overview' }],
  },
  {
    title: 'Platform',
    items: [
      { href: '/admin/tenants', icon: Building2, title: 'Tenants' },
      { href: '/superadmin/plans', icon: CreditCard, title: 'Plans & Billing' },
      { href: '/superadmin/reports', icon: BarChart2, title: 'Reports' },
      { href: '/superadmin/settings', icon: Settings, title: 'Settings' },
    ],
  },
]

const MENTOR_SECTIONS: NavSection[] = [
  {
    items: [
      { href: '/', icon: Home, title: 'Overview' },
      { href: '/companies', icon: Building2, title: 'My Companies' },
      { href: '/calendar', icon: Calendar, title: 'Calendar' },
      { href: '/documents', icon: FileText, title: 'Documents' },
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
        'flex flex-col h-screen bg-card border-r flex-shrink-0 transition-all duration-200',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Brand */}
      <div className={cn('flex items-center h-14 border-b flex-shrink-0', collapsed ? 'justify-center px-2' : 'px-4 gap-3')}>
        <div className="h-8 w-8 flex-shrink-0 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
          A
        </div>
        {!collapsed && <span className="font-semibold text-sm">AccelerateOS</span>}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {sections.map((section, si) => (
          <div key={si}>
            {section.title && !collapsed && (
              <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
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
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    collapsed && 'justify-center',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
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
      <div className="border-t p-2 flex-shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left',
                collapsed && 'justify-center px-2',
              )}
            >
              <Avatar className="h-7 w-7 flex-shrink-0">
                <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                  {initials(user?.name, user?.email)}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate leading-tight">
                      {user?.name || user?.email?.split('@')[0] || 'User'}
                    </p>
                    <p className="text-xs text-muted-foreground leading-tight">
                      {user?.role ? ROLE_LABELS[user.role] : ''}
                    </p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align={collapsed ? 'center' : 'start'} className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium">{user?.name || 'User'}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
