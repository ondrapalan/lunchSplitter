import { createGlobalStyle } from 'styled-components'

export const GlobalStyles = createGlobalStyle`
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html {
    color-scheme: ${({ theme }) => theme.colorScheme};
  }

  body {
    font-family: ${({ theme }) => theme.font};
    background: ${({ theme }) => theme.colors.background};
    color: ${({ theme }) => theme.colors.text};
    line-height: 1.6;
    min-height: 100vh;
    transition: background-color 0.2s ease, color 0.2s ease;
  }

  ::selection {
    background: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.background};
  }

  input, button, select {
    font-family: inherit;
    font-size: inherit;
  }
`
