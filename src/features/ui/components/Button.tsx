import styled, { css } from 'styled-components'

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
}

export const Button = styled.button<ButtonProps>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  border: 1px solid transparent;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  cursor: pointer;
  font-weight: 500;
  transition: all 0.15s ease;

  ${({ size = 'md', theme }) =>
    size === 'sm'
      ? css`
          padding: ${theme.spacing.xs} ${theme.spacing.sm};
          font-size: ${theme.fontSizes.sm};
        `
      : css`
          padding: ${theme.spacing.sm} ${theme.spacing.md};
          font-size: ${theme.fontSizes.md};
        `}

  ${({ variant = 'primary', theme }) => {
    switch (variant) {
      case 'primary':
        return css`
          background: ${theme.colors.primary};
          color: ${theme.colors.background};
          &:hover { opacity: 0.9; }
        `
      case 'secondary':
        return css`
          background: transparent;
          border-color: ${theme.colors.border};
          color: ${theme.colors.secondary};
          &:hover { border-color: ${theme.colors.secondary}; }
        `
      case 'danger':
        return css`
          background: transparent;
          color: ${theme.colors.negative};
          &:hover { background: rgba(255, 83, 112, 0.1); }
        `
      case 'ghost':
        return css`
          background: transparent;
          color: ${theme.colors.textMuted};
          &:hover { color: ${theme.colors.text}; }
        `
    }
  }}
`
