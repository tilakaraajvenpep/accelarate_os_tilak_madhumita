import type { TFunction } from 'i18next'
import {
  Home,
  Users,
  Building2,
  BarChart2,
  FileText,
  Calendar,
  Mail,
  Settings,
  Globe,
  CreditCard,
  MessageSquare,
  ShieldCheck,
  Ticket,
  Wrench,
  BookOpen,
  UserPlus,
  Layers,
  type LucideIcon,
} from 'lucide-react'
import type { UserRole } from '@/types/auth'

export type NavChild = {
  href?: string
  title: string
  children?: NavChild[]
}

export type NavItem = {
  href?: string
  icon: LucideIcon
  title: string
  children?: NavChild[]
}

export type NavSection = {
  title?: string
  items: NavItem[]
}

export function hasActiveDescendant(children: NavChild[], pathname: string): boolean {
  return children.some((c) => {
    if (c.href) return pathname === c.href || pathname.startsWith(`${c.href}/`)
    if (c.children) return hasActiveDescendant(c.children, pathname)
    return false
  })
}

export function firstHref(children: NavChild[]): string {
  for (const c of children) {
    if (c.href) return c.href
    if (c.children) return firstHref(c.children)
  }
  return '/'
}

export function founderSections(t: TFunction<'sidebar'>, cohortCalendarName?: string | null): NavSection[] {
  const calendarChildren =
    cohortCalendarName !== undefined
      ? [{ title: cohortCalendarName ? `${cohortCalendarName}` : t('nav.calendar'), href: '/calendar' }]
      : undefined

  return [
    {
      items: [
        { href: '/', icon: Home, title: t('nav.overview') },
        { href: '/my-programs', icon: BookOpen, title: t('nav.myPrograms') },
        { href: '/team', icon: Users, title: t('nav.team') },
        { href: '/documents', icon: FileText, title: t('nav.documents') },
        { href: '/calendar', icon: Calendar, title: t('nav.calendar'), children: calendarChildren },
        { href: '/messages', icon: MessageSquare, title: t('nav.messages') },
        { href: '/governance', icon: ShieldCheck, title: t('nav.governance') },
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
        { href: '/mentors', icon: UserPlus, title: t('nav.mentors') },
        {
          icon: Wrench,
          title: t('nav.setup'),
          children: [
            { href: '/setup/programs', title: t('nav.programs') },
            { href: '/setup/assessment-forms', title: t('nav.assessmentForms') },
          ],
        },
      ],
    },
    {
      title: t('sections.tools'),
      items: [
        { href: '/scoring', icon: BarChart2, title: t('nav.scoring') },
        { href: '/admin/submitted-answers', icon: MessageSquare, title: t('nav.submittedAnswers') },
        { href: '/documents', icon: FileText, title: t('nav.documents') },
        { href: '/calendar', icon: Calendar, title: t('nav.calendar') },
        {
          icon: ShieldCheck,
          title: t('nav.governance'),
          children: [
            { href: '/admin/governance/configs', title: t('nav.governanceConfigs') },
            { href: '/admin/governance/review', title: t('nav.governanceReview') },
          ],
        },
      ],
    },
    {
      title: t('nav.settings'),
      items: [
        { href: '/admin/email-templates', icon: Mail, title: t('nav.emailTemplates') },
        { href: '/settings', icon: Settings, title: t('nav.tenantSettings') },
      ],
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
        { href: '/mentor/assignments', icon: Layers, title: t('nav.myAssignments') },
        { href: '/mentor/programs', icon: BookOpen, title: t('nav.fillPrograms') },
        { href: '/mentor/cohorts', icon: Users, title: t('nav.allCohorts') },
        { href: '/mentor/submitted-answers', icon: MessageSquare, title: t('nav.submittedAnswers') },
        { href: '/mentor/governance/review', icon: ShieldCheck, title: t('nav.governanceReview') },
        { href: '/documents', icon: FileText, title: t('nav.documents') },
        { href: '/mentors', icon: UserPlus, title: t('nav.inviteMentors') },
        { href: '/settings', icon: Settings, title: t('nav.tenantSettings') },
      ],
    },
  ]
}

export function getSections(
  t: TFunction<'sidebar'>,
  role?: UserRole,
  interestedInMentoring?: boolean,
  founderCohortCalendarName?: string | null,
  allowedMenus?: string[] | null,
): NavSection[] {
  let sections: NavSection[] = []
  switch (role) {
    case 'super_admin':
      sections = superAdminSections(t)
      break
    case 'admin':
      sections = interestedInMentoring
        ? [
            ...adminSections(t),
            {
              title: t('sections.mentor'),
              items: [
                { href: '/mentor/assignments', icon: Layers, title: t('nav.myAssignments') },
                { href: '/mentor/programs', icon: BookOpen, title: t('nav.fillPrograms') },
                { href: '/mentor/cohorts', icon: Users, title: t('nav.allCohorts') },
                { href: '/mentor/submitted-answers', icon: MessageSquare, title: t('nav.submittedAnswers') },
                { href: '/mentor/governance/review', icon: ShieldCheck, title: t('nav.governanceReview') },
              ],
            },
          ]
        : adminSections(t)
      break
    case 'mentor':
      sections = mentorSections(t)
      break
    default:
      sections = founderSections(t, founderCohortCalendarName)
      break
  }

  if (allowedMenus && Array.isArray(allowedMenus) && (role === 'mentor' || role === 'founder')) {
    sections = sections.map((s) => ({
      ...s,
      items: s.items.filter((item) => {
        if (!item.href) return true
        return allowedMenus.includes(item.href)
      }),
    })).filter((s) => s.items.length > 0)
  }

  return sections
}

export interface FlatNavItem {
  title: string
  href: string
}

function flattenChildren(children: NavChild[]): FlatNavItem[] {
  return children.flatMap((c) => {
    const own = c.href ? [{ title: c.title, href: c.href }] : []
    const nested = c.children ? flattenChildren(c.children) : []
    return [...own, ...nested]
  })
}

/** Every navigable {title, href} pair across all sections — including nested "Setup" children — for the given role. Used to power the header's quick-search. */
export function flattenNavItems(sections: NavSection[]): FlatNavItem[] {
  return sections.flatMap((section) =>
    section.items.flatMap((item) => {
      const own = item.href ? [{ title: item.title, href: item.href }] : []
      const nested = item.children ? flattenChildren(item.children) : []
      return [...own, ...nested]
    }),
  )
}
