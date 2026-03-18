'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { lightTheme, darkTheme } from './index'
import type { Theme } from './index'

type ThemeMode = 'system' | 'light' | 'dark'

interface ThemeContextValue {
  mode: ThemeMode
  resolvedTheme: 'light' | 'dark'
  theme: Theme
  setMode: (mode: ThemeMode) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'theme-preference'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode)
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(getSystemTheme)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode)
    localStorage.setItem(STORAGE_KEY, newMode)
    const resolved = newMode === 'system' ? getSystemTheme() : newMode
    document.documentElement.dataset.theme = resolved
    document.documentElement.style.colorScheme = resolved
  }, [])

  const toggleTheme = useCallback(() => {
    const next: ThemeMode = mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light'
    setMode(next)
  }, [mode, setMode])

  const resolvedTheme = mode === 'system' ? systemTheme : mode
  const theme = resolvedTheme === 'light' ? lightTheme : darkTheme

  const value = useMemo(
    () => ({ mode, resolvedTheme, theme, setMode, toggleTheme }),
    [mode, resolvedTheme, theme, setMode, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useThemeMode must be used within ThemeModeProvider')
  return ctx
}
