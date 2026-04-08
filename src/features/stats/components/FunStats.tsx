'use client'

import { useEffect, useState } from 'react'
import styled from 'styled-components'
import { Card, CardTitle } from '~/features/ui/components/Card'
import { getFunStats } from '~/actions/stats'
import type { FunStat } from '../types'
import { media } from '~/features/ui/theme'

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${({ theme }) => theme.spacing.md};

  ${media.mobile} {
    grid-template-columns: 1fr;
  }
`

const StatCard = styled.div`
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
`

const StatTitle = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`

const PersonName = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.lg};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  margin-top: ${({ theme }) => theme.spacing.xs};
`

const StatValue = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.primary};
  font-weight: 500;
  margin-top: 2px;
`

const StatSubtitle = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textDim};
  margin-top: ${({ theme }) => theme.spacing.xs};
`

const EmptyState = styled.div`
  text-align: center;
  color: ${({ theme }) => theme.colors.textMuted};
  padding: ${({ theme }) => theme.spacing.lg};
`

export function FunStats() {
  const [stats, setStats] = useState<FunStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getFunStats()
      .then(setStats)
      .finally(() => setLoading(false))
  }, [])

  return (
    <Card>
      <CardTitle>Fun Stats</CardTitle>
      {loading ? (
        <EmptyState>Loading...</EmptyState>
      ) : stats.length === 0 ? (
        <EmptyState>Not enough data for fun stats yet</EmptyState>
      ) : (
        <Grid>
          {stats.map(stat => (
            <StatCard key={stat.title}>
              <StatTitle>{stat.title}</StatTitle>
              <PersonName>{stat.personName}</PersonName>
              <StatValue>{stat.value}</StatValue>
              <StatSubtitle>{stat.subtitle}</StatSubtitle>
            </StatCard>
          ))}
        </Grid>
      )}
    </Card>
  )
}
