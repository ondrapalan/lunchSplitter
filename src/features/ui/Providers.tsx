'use client'

import { useState } from 'react'
import { SessionProvider } from 'next-auth/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'styled-components'
import { ToastContainer } from 'react-toastify'
import { GlobalStyles } from '~/GlobalStyles'
import { ThemeModeProvider, useThemeMode } from '~/features/ui/theme/ThemeContext'
import { ConfirmDialogProvider } from '~/features/ui/components/ConfirmDialog'
import { VersionBadge } from '~/features/ui/components/VersionBadge'

function ThemedApp({ children }: { children: React.ReactNode }) {
  const { theme, mode } = useThemeMode()

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles />
      <ToastContainer position="bottom-right" theme={mode} />
      <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
      <VersionBadge />
    </ThemeProvider>
  )
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  )

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
