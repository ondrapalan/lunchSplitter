'use client'

import { useState } from 'react'
import styled from 'styled-components'
import { Card, CardTitle } from '~/features/ui/components/Card'
import { Button } from '~/features/ui/components/Button'
import { useStatsBundle } from '~/lib/queries/stats'
import { formatCurrency } from '~/features/lunch/utils/formatters'
import type { StatPeriod } from '../types'
import { media } from '~/features/ui/theme'

const PeriodBar = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.xs};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  flex-wrap: wrap;
`

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`

const Th = styled.th`
  text-align: left;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 500;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`

const ThRight = styled(Th)`
  text-align: right;
`

const Td = styled.td`
  padding: ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`

const TdRight = styled(Td)`
  text-align: right;
  font-variant-numeric: tabular-nums;
`

const Rank = styled.span<{ $rank: number }>`
  font-weight: ${({ $rank }) => ($rank <= 3 ? 600 : 400)};
  color: ${({ $rank, theme }) =>
    $rank === 1 ? '#D4A017' :
    $rank === 2 ? '#8A8A8A' :
    $rank === 3 ? '#CD7F32' :
    theme.colors.text};
`

const Medal = styled.span`
  margin-right: ${({ theme }) => theme.spacing.xs};
`

const SpentAmount = styled.span`
  color: ${({ theme }) => theme.colors.positive};
  font-weight: 600;
`

const EmptyRow = styled.td`
  padding: ${({ theme }) => theme.spacing.lg};
  text-align: center;
  color: ${({ theme }) => theme.colors.textMuted};
`

const HideMobile = styled.span`
  ${media.mobile} {
    display: none;
  }
`

const MEDALS = ['', '\u{1F947}', '\u{1F948}', '\u{1F949}']

const PERIODS: { value: StatPeriod; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All Time' },
]

export function SpendingLeaderboard() {
  const [period, setPeriod] = useState<StatPeriod>('month')
  const { data: entries = [], isPending: loading } = useStatsBundle(period, b => b.spending)

  return (
    <Card>
      <CardTitle>Spending Leaderboard</CardTitle>
      <PeriodBar>
        {PERIODS.map(p => (
          <Button
            key={p.value}
            variant={period === p.value ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setPeriod(p.value)}
          >
            {p.label}
          </Button>
        ))}
      </PeriodBar>
      <Table>
        <thead>
          <tr>
            <Th>#</Th>
            <Th>Name</Th>
            <ThRight>Spent</ThRight>
            <ThRight><HideMobile>Orders</HideMobile></ThRight>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><EmptyRow colSpan={4}>Loading...</EmptyRow></tr>
          ) : entries.length === 0 ? (
            <tr><EmptyRow colSpan={4}>No orders in this period</EmptyRow></tr>
          ) : (
            entries.map((entry, i) => {
              const rank = i + 1
              return (
                <tr key={entry.userId ?? entry.name}>
                  <Td>
                    <Rank $rank={rank}>
                      {MEDALS[rank] && <Medal>{MEDALS[rank]}</Medal>}
                      {rank}
                    </Rank>
                  </Td>
                  <Td>{entry.name}</Td>
                  <TdRight><SpentAmount>{formatCurrency(entry.totalSpent)}</SpentAmount></TdRight>
                  <TdRight><HideMobile>{entry.orderCount}</HideMobile></TdRight>
                </tr>
              )
            })
          )}
        </tbody>
      </Table>
    </Card>
  )
}
