import styled from 'styled-components'
import { withAlpha } from '~/features/ui/theme'

export const StatusBadge = styled.span<{ $status: 'OPEN' | 'CLOSED' }>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 500;
  background: ${({ $status, theme }) =>
    $status === 'OPEN' ? withAlpha(theme.colors.positive, 0.15) : withAlpha(theme.colors.secondary, 0.15)};
  color: ${({ $status, theme }) =>
    $status === 'OPEN' ? theme.colors.positive : theme.colors.secondary};
`
