import type { Metadata } from 'next'
import { StyledComponentsRegistry } from '~/features/ui/StyledComponentsRegistry'
import { Providers } from '~/features/ui/Providers'

export const metadata: Metadata = {
  title: 'Lunch Splitter',
}

// Must match darkTheme.colors.background in src/features/ui/theme/index.ts
const themeScript = `
(function() {
  try {
    var stored = localStorage.getItem('theme-preference');
    var resolved = stored === 'light' ? 'light' : stored === 'dark' ? 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (resolved === 'dark') {
      document.documentElement.style.backgroundColor = '#171412';
      if (meta) meta.setAttribute('content', '#171412');
    } else {
      if (meta) meta.setAttribute('content', '#FFFFFF');
    }
  } catch(e) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#171412" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <StyledComponentsRegistry>
          <Providers>{children}</Providers>
        </StyledComponentsRegistry>
      </body>
    </html>
  )
}
