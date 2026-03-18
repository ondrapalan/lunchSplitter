'use client'

import { useState } from 'react'
import { SessionProvider } from 'next-auth/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'styled-components'
import { ToastContainer } from 'react-toastify'
import { GlobalStyles } from '~/GlobalStyles'
import { ThemeModeProvider, useThemeMode } from '~/features/ui/theme/ThemeContext'

function ThemedApp({ children }: { children: React.ReactNode }) {
  const { theme, resolvedTheme } = useThemeMode()

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles />
      <ToastContainer position="bottom-right" theme={resolvedTheme} />
      {children}
    </ThemeProvider>
  )
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeModeProvider>
          <ThemedApp>{children}</ThemedApp>
        </ThemeModeProvider>
      </QueryClientProvider>
    </SessionProvider>
  )
}
