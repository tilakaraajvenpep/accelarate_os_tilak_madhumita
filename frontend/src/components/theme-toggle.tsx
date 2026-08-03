import { Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/context/theme-context'
import { cn } from '@/lib/utils'

export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useTranslation('common')
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')}
      aria-label={t('theme.toggleTheme')}
      className={cn(
        'h-8 w-8 flex items-center justify-center rounded-lg border border-glass-border bg-glass',
        'text-ink/60 hover:text-ink hover:bg-glass-2 transition-colors',
        className,
      )}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
