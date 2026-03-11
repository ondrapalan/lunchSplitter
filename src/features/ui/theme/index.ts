export const theme = {
  colors: {
    background: '#0f1419',
    surface: '#1a2027',
    surfaceLight: '#232d37',
    primary: '#4fc3f7',
    primaryDark: '#039be5',
    secondary: '#90a4ae',
    text: '#e0e0e0',
    textMuted: '#78909c',
    textDim: '#546e7a',
    accent: '#4dd0e1',
    positive: '#81c784',
    negative: '#ef5350',
    warning: '#ffb74d',
    border: '#263238',
    cardBackground: '#141c22',
  },
  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.5rem',
    xxl: '2rem',
  },
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  typography: {
    heading: {
      fontWeight: 600,
      letterSpacing: '-0.02em',
    },
    body: {
      fontWeight: 400,
      lineHeight: 1.6,
    },
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
  },
} as const

export type Theme = typeof theme
