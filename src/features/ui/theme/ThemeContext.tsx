'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { lightTheme, darkTheme } from './index'
import type { Theme } from './index'

type ThemeMode = 'light' | 'dark'

interface ThemeContextValue {
  mode: ThemeMode
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'theme-preference'

function getInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'dark'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  // First visit — use system preference as initial default
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode)

  const toggleTheme = useCallback(() => {
    const next: ThemeMode = mode === 'light' ? 'dark' : 'light'
    setModeState(next)
    localStorage.setItem(STORAGE_KEY, next)
    document.documentElement.dataset.theme = next
    document.documentElement.style.colorScheme = next
  }, [mode])

  const theme = mode === 'light' ? lightTheme : darkTheme

  const value = useMemo(
    () => ({ mode, theme, toggleTheme }),
    [mode, theme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useThemeMode must be used within ThemeModeProvider')
  return ctx
}
