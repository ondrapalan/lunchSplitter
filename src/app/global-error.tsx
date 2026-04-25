'use client'

import { darkTheme } from '~/features/ui/theme'

// global-error renders OUTSIDE the React tree (no ThemeProvider available),
// so we can't use styled-components here. We CAN still pull the literal hex
// values from the dark theme so they don't drift away from the rest of the
// app on theme tweaks. Always renders in dark colors — a half-loaded
// global error is the wrong moment to negotiate light/dark.
const c = darkTheme.colors

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body
        style={{
          margin: 0,
          fontFamily:
            "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          background: c.background,
          color: c.text,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <div
          style={{
            maxWidth: '480px',
            background: c.cardBackground,
            border: `1px solid ${c.border}`,
            borderRadius: '8px',
            padding: '24px',
          }}
        >
          <h1
            style={{
              margin: '0 0 16px',
              fontSize: '1.5rem',
              fontWeight: 600,
              letterSpacing: '-0.02em',
            }}
          >
            Something went wrong
          </h1>
          <p style={{ margin: '0 0 8px', color: c.textMuted }}>
            {process.env.NODE_ENV === 'development' && error.message
              ? error.message
              : 'An unexpected error occurred.'}
          </p>
          {error.digest && (
            <>
              <p
                style={{
                  margin: '0 0 4px',
                  color: c.textDim,
                  fontSize: '0.875rem',
                }}
              >
                Share this reference when reporting the issue:
              </p>
              <code
                style={{
                  display: 'block',
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                  fontSize: '0.875rem',
                  background: c.surface,
                  border: `1px solid ${c.border}`,
                  borderRadius: '4px',
                  padding: '4px 8px',
                  marginBottom: '16px',
                  wordBreak: 'break-all',
                }}
              >
                {error.digest}
              </code>
            </>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              background: c.primary,
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 16px',
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
