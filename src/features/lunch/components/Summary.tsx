import styled from 'styled-components'
import { Card } from '~/features/ui/components/Card'
import { SectionTitle } from '~/features/ui/components/SectionTitle'
import { formatCurrency } from '../utils/formatters'
import type { PersonSummary } from '../types'

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`

const Th = styled.th`
  text-align: left;
  padding: ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};

  &:not(:first-child) {
    text-align: right;
  }
`

const Td = styled.td`
  padding: ${({ theme }) => theme.spacing.sm};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};

  &:not(:first-child) {
    text-align: right;
  }
`

const TotalTd = styled(Td)`
  border-bottom: none;
  border-top: 2px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.primary};
  font-weight: 600;
`

const FinalAmount = styled(Td)`
  color: ${({ theme }) => theme.colors.primary};
  font-weight: 600;
`

interface SummaryProps {
  summaries: PersonSummary[]
  grandTotal: number
}

export function Summary({ summaries, grandTotal }: SummaryProps) {
  if (summaries.length === 0) return null

  return (
    <Card>
      <SectionTitle>Summary</SectionTitle>
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Subtotal</Th>
            <Th>After Discount</Th>
            <Th>With Fees</Th>
          </tr>
        </thead>
        <tbody>
          {summaries.map(s => (
            <tr key={s.personId}>
              <Td>{s.name}</Td>
              <Td>{formatCurrency(s.subtotal)}</Td>
              <Td>{formatCurrency(s.afterDiscount)}</Td>
              <FinalAmount>{formatCurrency(s.withFees)}</FinalAmount>
            </tr>
          ))}
          <tr>
            <TotalTd>Total</TotalTd>
            <TotalTd />
            <TotalTd />
            <TotalTd>{formatCurrency(grandTotal)}</TotalTd>
          </tr>
        </tbody>
      </Table>
    </Card>
  )
}
