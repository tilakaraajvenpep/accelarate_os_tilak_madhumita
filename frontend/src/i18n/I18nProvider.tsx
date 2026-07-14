import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { translations, LANGUAGES, type Language } from './translations'

/**
 * Portable i18n engine — the only file this depends on is ./translations.
 * Copy the whole i18n/ folder into another project and replace the content
 * of translations.ts to reuse it.
 */

const STORAGE_KEY = 'aos_language'
const DEFAULT_LANGUAGE: Language = 'en'

interface I18nContextValue {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function isLanguage(value: string | null): value is Language {
  return !!value && LANGUAGES.some((l) => l.code === value)
}

function getInitialLanguage(): Language {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return isLanguage(stored) ? stored : DEFAULT_LANGUAGE
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language)
    document.documentElement.lang = language
  }, [language])

  const value = useMemo<I18nContextValue>(() => {
    const dict = translations[language] ?? translations[DEFAULT_LANGUAGE]
    const fallbackDict = translations[DEFAULT_LANGUAGE]

    function t(key: string, vars?: Record<string, string | number>) {
      let text = dict[key] ?? fallbackDict[key] ?? key
      if (vars) {
        for (const [name, val] of Object.entries(vars)) {
          text = text.replace(new RegExp(`{{${name}}}`, 'g'), String(val))
        }
      }
      return text
    }

    return { language, setLanguage: setLanguageState, t }
  }, [language])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useTranslation() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useTranslation must be used inside <I18nProvider>')
  return ctx
}
