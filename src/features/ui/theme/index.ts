// src/features/ui/theme/index.ts

interface ThemeColors {
  background: string
  surface: string
  surfaceLight: string
  primary: string
  primaryDark: string
  secondary: string
  text: string
  textMuted: string
  textDim: string
  accent: string
  positive: string
  negative: string
  warning: string
  border: string
  cardBackground: string
}

const baseTheme = {
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

export interface Theme {
  colorScheme: 'light' | 'dark'
  colors: ThemeColors
  fontSizes: typeof baseTheme.fontSizes
  font: typeof baseTheme.font
  typography: typeof baseTheme.typography
  spacing: typeof baseTheme.spacing
  borderRadius: typeof baseTheme.borderRadius
}

/** Append hex alpha to a 6-digit hex color. `alpha` is 0–1. */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0')
  return `${hex}${a}`
}

export const lightTheme: Theme = {
  ...baseTheme,
  colorScheme: 'light',
  colors: {
    background: '#FFFFFF',
    surface: '#F5F7FA',
    surfaceLight: '#EDF1F7',
    primary: '#1C5DB7',
    primaryDark: '#134A96',
    secondary: '#5A6978',
    text: '#1A1A2E',
    textMuted: '#657383',
    textDim: '#6B7A8D',
    accent: '#C47415',
    positive: '#178043',
    negative: '#D32F2F',
    warning: '#B86E00',
    border: '#DDE3ED',
    cardBackground: '#FFFFFF',
  },
}

export const darkTheme: Theme = {
  ...baseTheme,
  colorScheme: 'dark',
  colors: {
    background: '#171412',
    surface: '#211E1B',
    surfaceLight: '#2E2926',
    primary: '#5B9BE6',
    primaryDark: '#1C5DB7',
    secondary: '#A89F95',
    text: '#EDE8E3',
    textMuted: '#8D847A',
    textDim: '#5E564E',
    accent: '#E8963A',
    positive: '#66BB6A',
    negative: '#EF5350',
    warning: '#FFB74D',
    border: '#362F2B',
    cardBackground: '#1C1916',
  },
}

// Backwards compat — remove after full migration
export const theme = darkTheme
