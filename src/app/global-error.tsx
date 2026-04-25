'use client'

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
          background: '#171412',
          color: '#EDE8E3',
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
            background: '#1C1916',
            border: '1px solid #362F2B',
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
          <p style={{ margin: '0 0 8px', color: '#8D847A' }}>
            {process.env.NODE_ENV === 'development' && error.message
              ? error.message
              : 'An unexpected error occurred.'}
          </p>
          {error.digest && (
            <>
              <p
                style={{
                  margin: '0 0 4px',
                  color: '#5E564E',
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
                  background: '#211E1B',
                  border: '1px solid #362F2B',
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
              background: '#1C5DB7',
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
