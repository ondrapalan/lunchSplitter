'use client'

import { useState } from 'react'
import styled from 'styled-components'
import { Card, CardTitle } from '~/features/ui/components/Card'
import { Button } from '~/features/ui/components/Button'
import { useStatsBundle } from '~/lib/queries/stats'
import { formatCurrency } from '~/features/lunch/utils/formatters'
import type { SekackaStatsData, StatPeriod } from '../types'
import { media } from '~/features/ui/theme'

const PeriodBar = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.xs};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  flex-wrap: wrap;
`

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${({ theme }) => theme.spacing.sm};
  margin-bottom: ${({ theme }) => theme.spacing.md};

  ${media.mobile} {
    grid-template-columns: repeat(2, 1fr);
  }
`

const SummaryCell = styled.div`
  padding: ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
`

const SummaryLabel = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`

const SummaryValue = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.xl};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  margin-top: 2px;
  font-variant-numeric: tabular-nums;
`

const LeaderTitle = styled.h4`
  margin: ${({ theme }) => theme.spacing.md} 0 ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.fontSizes.md};
  color: ${({ theme }) => theme.colors.text};
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

const MEDALS = ['', '\u{1F947}', '\u{1F948}', '\u{1F949}']

const PERIODS: { value: StatPeriod; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All Time' },
]

function emptyData(): SekackaStatsData {
  return {
    summary: { totalCount: 0, totalSpent: 0, avgParticipants: 0, avgPerPortion: 0 },
    topEaters: [],
    topProviders: [],
    items: [],
  }
}

export function SekackaStats() {
  const [period, setPeriod] = useState<StatPeriod>('all')
  const { data: sekacka, isPending: loading } = useStatsBundle(period, b => b.sekacka)
  const data: SekackaStatsData = sekacka ?? emptyData()
  const { summary, topEaters, topProviders, items } = data
  const isEmpty = !loading && summary.totalCount === 0

  return (
    <Card>
      <CardTitle>🥩 Sekačka stats</CardTitle>
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

      <SummaryGrid>
        <SummaryCell>
          <SummaryLabel>Sekačkas</SummaryLabel>
          <SummaryValue>{summary.totalCount}</SummaryValue>
        </SummaryCell>
        <SummaryCell>
          <SummaryLabel>Total Kč</SummaryLabel>
          <SummaryValue>{formatCurrency(summary.totalSpent)}</SummaryValue>
        </SummaryCell>
        <SummaryCell>
          <SummaryLabel>Ø participants</SummaryLabel>
          <SummaryValue>{summary.avgParticipants.toFixed(1)}</SummaryValue>
        </SummaryCell>
        <SummaryCell>
          <SummaryLabel>Ø per portion</SummaryLabel>
          <SummaryValue>{formatCurrency(summary.avgPerPortion)}</SummaryValue>
        </SummaryCell>
      </SummaryGrid>

      {isEmpty ? (
        <div style={{ textAlign: 'center', padding: 16, color: 'var(--muted)' }}>
          No closed Sekačka in this period yet.
        </div>
      ) : (
        <>
          <LeaderTitle>Top sekanožrouti</LeaderTitle>
          <Table>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Name</Th>
                <ThRight>Portions</ThRight>
                <ThRight>Spent</ThRight>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><EmptyRow colSpan={4}>Loading…</EmptyRow></tr>
              ) : topEaters.length === 0 ? (
                <tr><EmptyRow colSpan={4}>—</EmptyRow></tr>
              ) : (
                topEaters.map((e, i) => {
                  const rank = i + 1
                  return (
                    <tr key={e.userId ?? e.name}>
                      <Td>
                        <Rank $rank={rank}>
                          {MEDALS[rank] && <Medal>{MEDALS[rank]}</Medal>}
                          {rank}
                        </Rank>
                      </Td>
                      <Td>{e.name}</Td>
                      <TdRight>{e.count}</TdRight>
                      <TdRight><SpentAmount>{formatCurrency(e.totalKc)}</SpentAmount></TdRight>
                    </tr>
                  )
                })
              )}
            </tbody>
          </Table>

          <LeaderTitle>The Sekačka Provider</LeaderTitle>
          <Table>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Name</Th>
                <ThRight>Brought</ThRight>
                <ThRight>Total Kč</ThRight>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><EmptyRow colSpan={4}>Loading…</EmptyRow></tr>
              ) : topProviders.length === 0 ? (
                <tr><EmptyRow colSpan={4}>—</EmptyRow></tr>
              ) : (
                topProviders.map((p, i) => {
                  const rank = i + 1
                  return (
                    <tr key={p.userId ?? p.name}>
                      <Td>
                        <Rank $rank={rank}>
                          {MEDALS[rank] && <Medal>{MEDALS[rank]}</Medal>}
                          {rank}
                        </Rank>
                      </Td>
                      <Td>{p.name}</Td>
                      <TdRight>{p.count}×</TdRight>
                      <TdRight><SpentAmount>{formatCurrency(p.totalKc)}</SpentAmount></TdRight>
                    </tr>
                  )
                })
              )}
            </tbody>
          </Table>

          <LeaderTitle>Co se kupovalo</LeaderTitle>
          <Table>
            <thead>
              <tr>
                <Th>Item</Th>
                <ThRight>Times</ThRight>
                <ThRight>Total Kč</ThRight>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><EmptyRow colSpan={3}>Loading…</EmptyRow></tr>
              ) : items.length === 0 ? (
                <tr><EmptyRow colSpan={3}>—</EmptyRow></tr>
              ) : (
                items.map(it => (
                  <tr key={it.name}>
                    <Td>{it.name}</Td>
                    <TdRight>{it.occurrences}</TdRight>
                    <TdRight><SpentAmount>{formatCurrency(it.totalKc)}</SpentAmount></TdRight>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </>
      )}
    </Card>
  )
}
