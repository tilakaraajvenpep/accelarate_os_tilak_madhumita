import { Check, Languages } from 'lucide-react'
import { useTranslation } from './I18nProvider'
import { LANGUAGES } from './translations'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * Opens a dropdown listing every language in LANGUAGES — pick one to switch.
 * Drop this next to <ThemeToggle /> anywhere.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const { language, setLanguage } = useTranslation()
  const current = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Select language"
          className={cn(
            'h-8 px-2.5 flex items-center gap-1.5 rounded-lg border border-glass-border bg-glass',
            'text-xs font-medium text-ink/60 hover:text-ink hover:bg-glass-2 transition-colors',
            className,
          )}
        >
          <Languages className="h-3.5 w-3.5" />
          {current.shortLabel}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[9rem]">
        {LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => setLanguage(l.code)}
            className="flex items-center justify-between gap-2"
          >
            {l.label}
            {l.code === language && <Check className="h-3.5 w-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
