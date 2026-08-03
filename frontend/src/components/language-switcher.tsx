import { Globe, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { SUPPORTED_LANGUAGES } from '@/i18n/config'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n } = useTranslation()
  const current = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) ?? SUPPORTED_LANGUAGES[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          title="Change language"
          aria-label="Change language"
          className={cn(
            'h-8 px-2.5 flex items-center gap-1.5 rounded-lg border border-glass-border bg-glass',
            'text-ink/60 hover:text-ink hover:bg-glass-2 transition-colors text-xs font-medium',
            className,
          )}
        >
          <Globe className="h-4 w-4" />
          {current.label}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[8rem]">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem key={lang.code} onClick={() => i18n.changeLanguage(lang.code)}>
            <span className="flex-1">{lang.label}</span>
            {lang.code === current.code && <Check className="h-3.5 w-3.5 ml-2" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
