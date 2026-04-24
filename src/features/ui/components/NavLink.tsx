import styled from 'styled-components'
import { media } from '~/features/ui/theme'

export const NavLink = styled.button<{ $active: boolean }>`
  background: ${({ $active, theme }) => ($active ? theme.colors.primary : 'transparent')};
  color: ${({ $active, theme }) => ($active ? theme.colors.background : theme.colors.text)};
  border: 1px solid ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.border)};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: 500;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
  }

  ${media.mobile} {
    min-height: 44px;
    padding: ${({ theme }) => theme.spacing.sm};
    justify-content: center;
  }
`

export const NavLabel = styled.span`
  ${media.mobile} {
    display: none;
  }
`

export const NavIcon = styled.span`
  display: inline-flex;
  line-height: 0;
`
