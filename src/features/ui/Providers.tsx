'use client'

import { useState } from 'react'
import { SessionProvider } from 'next-auth/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'styled-components'
import { ToastContainer } from 'react-toastify'
import { theme } from '~/features/ui/theme'
import { GlobalStyles } from '~/GlobalStyles'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <GlobalStyles />
          <ToastContainer position="bottom-right" theme="dark" />
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  )
}
