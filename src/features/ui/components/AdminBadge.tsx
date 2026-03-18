import styled from 'styled-components'
import { withAlpha } from '~/features/ui/theme'

export const AdminBadge = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 500;
  background: ${({ theme }) => withAlpha(theme.colors.accent, 0.15)};
  color: ${({ theme }) => theme.colors.accent};
`
