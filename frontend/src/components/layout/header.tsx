import { PanelLeft, Bell, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'
import { LanguageSwitcher } from '@/components/language-switcher'

interface HeaderProps {
  onToggleSidebar: () => void
  collapsed: boolean
}

export function Header({ onToggleSidebar, collapsed }: HeaderProps) {
  const { t } = useTranslation(['header', 'common'])

  return (
    <header className="relative z-10 h-14 border-b border-glass-border bg-glass backdrop-blur-xl flex items-center gap-3 px-4 flex-shrink-0">
      <button
        onClick={onToggleSidebar}
        className={cn(
          'h-8 w-8 flex items-center justify-center rounded-lg border border-glass-border bg-glass',
          'hover:bg-glass-2 transition-colors text-ink/40 hover:text-ink/70',
        )}
        title={collapsed ? t('header:expandSidebar') : t('header:collapseSidebar')}
      >
        <PanelLeft className="h-4 w-4" />
      </button>

      {/* Search bar */}
      <div className="flex-1 max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink/25" />
          <input
            type="text"
            placeholder={t('common:search')}
            className="w-full h-8 pl-8 pr-3 rounded-lg border border-glass-border bg-glass text-sm text-ink/70 placeholder:text-ink/20 outline-none focus:border-glass-border focus:bg-glass-2 transition-all"
          />
        </div>
      </div>

      <div className="flex-1" />

      <LanguageSwitcher />
      <ThemeToggle />

      {/* Notifications */}
      <button className="relative h-8 w-8 flex items-center justify-center rounded-lg border border-glass-border bg-glass hover:bg-glass-2 transition-colors text-ink/40 hover:text-ink/70">
        <Bell className="h-4 w-4" />
        <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[oklch(0.65_0.22_30)]" />
      </button>
    </header>
  )
}
