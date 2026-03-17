import styled from 'styled-components'

export const StatusBadge = styled.span<{ $status: 'OPEN' | 'CLOSED' }>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 500;
  background: ${({ $status }) =>
    $status === 'OPEN' ? 'rgba(129, 199, 132, 0.15)' : 'rgba(144, 164, 174, 0.15)'};
  color: ${({ $status, theme }) =>
    $status === 'OPEN' ? theme.colors.positive : theme.colors.secondary};
`
