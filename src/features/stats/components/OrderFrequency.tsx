'use client'

import { useState } from 'react'
import styled from 'styled-components'
import { Card, CardTitle } from '~/features/ui/components/Card'
import { Button } from '~/features/ui/components/Button'
import { useStatsBundle } from '~/lib/queries/stats'
import type { StatPeriod } from '../types'

const PeriodBar = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.xs};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  flex-wrap: wrap;
`

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.xs} 0;
`

const Name = styled.span`
  min-width: 100px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  flex-shrink: 0;
`

const BarContainer = styled.div`
  flex: 1;
  height: 20px;
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  overflow: hidden;
`

const Bar = styled.div<{ $width: number }>`
  height: 100%;
  width: ${({ $width }) => $width}%;
  background: ${({ theme }) => theme.colors.primary};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  transition: width 0.3s ease;
  min-width: ${({ $width }) => ($width > 0 ? '2px' : '0')};
`

const Count = styled.span`
  min-width: 30px;
  text-align: right;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: 600;
  font-variant-numeric: tabular-nums;
`

const EmptyState = styled.div`
  text-align: center;
  color: ${({ theme }) => theme.colors.textMuted};
  padding: ${({ theme }) => theme.spacing.lg};
`

const PERIODS: { value: StatPeriod; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All Time' },
]

export function OrderFrequency() {
  const [period, setPeriod] = useState<StatPeriod>('month')
  const { data: entries = [], isPending: loading } = useStatsBundle(period, b => b.frequency)

  const maxCount = entries.length > 0 ? entries[0].orderCount : 1

  return (
    <Card>
      <CardTitle>Order Frequency</CardTitle>
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
      {loading ? (
        <EmptyState>Loading...</EmptyState>
      ) : entries.length === 0 ? (
        <EmptyState>No orders in this period</EmptyState>
      ) : (
        entries.map(entry => (
          <Row key={entry.userId ?? entry.name}>
            <Name>{entry.name}</Name>
            <BarContainer>
              <Bar $width={(entry.orderCount / maxCount) * 100} />
            </BarContainer>
            <Count>{entry.orderCount}</Count>
          </Row>
        ))
      )}
    </Card>
  )
}
