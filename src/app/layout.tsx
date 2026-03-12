import type { Metadata } from 'next'
import { StyledComponentsRegistry } from '~/features/ui/StyledComponentsRegistry'
import { Providers } from '~/features/ui/Providers'

export const metadata: Metadata = {
  title: 'Lunch Splitter',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StyledComponentsRegistry>
          <Providers>{children}</Providers>
        </StyledComponentsRegistry>
      </body>
    </html>
  )
}
