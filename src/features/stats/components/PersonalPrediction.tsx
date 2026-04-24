'use client'

import styled from 'styled-components'
import { Card, CardTitle } from '~/features/ui/components/Card'
import { useStatsBundle } from '~/lib/queries/stats'
import { formatCurrency } from '~/features/lunch/utils/formatters'
import { media } from '~/features/ui/theme'

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${({ theme }) => theme.spacing.md};

  ${media.mobile} {
    grid-template-columns: 1fr;
  }
`

const StatBox = styled.div`
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
`

const StatLabel = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
`

const StatValue = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.lg};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  font-variant-numeric: tabular-nums;
`

const Projection = styled.div`
  margin-top: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ theme }) => theme.colors.accent};
`

const ProjectionLabel = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.accent};
  font-weight: 500;
`

const ProjectionValue = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.xl};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.accent};
  margin-top: ${({ theme }) => theme.spacing.xs};
`

const ProjectionDetail = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  margin-top: ${({ theme }) => theme.spacing.xs};
`

const EmptyState = styled.div`
  text-align: center;
  color: ${({ theme }) => theme.colors.textMuted};
  padding: ${({ theme }) => theme.spacing.lg};
`

export function PersonalPrediction() {
  const { data: stats, isPending: loading } = useStatsBundle('month', b => b.personal)

  if (loading) {
    return (
      <Card>
        <CardTitle>Your Stats</CardTitle>
        <EmptyState>Loading...</EmptyState>
      </Card>
    )
  }

  if (!stats || stats.totalOrders === 0) {
    return (
      <Card>
        <CardTitle>Your Stats</CardTitle>
        <EmptyState>No order history yet</EmptyState>
      </Card>
    )
  }

  return (
    <Card>
      <CardTitle>Your Stats</CardTitle>
      <Grid>
        <StatBox>
          <StatLabel>This Week</StatLabel>
          <StatValue>{formatCurrency(stats.weekSpent)}</StatValue>
        </StatBox>
        <StatBox>
          <StatLabel>This Month</StatLabel>
          <StatValue>{formatCurrency(stats.monthSpent)}</StatValue>
        </StatBox>
        <StatBox>
          <StatLabel>This Year</StatLabel>
          <StatValue>{formatCurrency(stats.yearSpent)}</StatValue>
        </StatBox>
        <StatBox>
          <StatLabel>All Time</StatLabel>
          <StatValue>{formatCurrency(stats.allTimeSpent)}</StatValue>
        </StatBox>
      </Grid>
      <Projection>
        <ProjectionLabel>Projected Yearly Spending</ProjectionLabel>
        <ProjectionValue>{formatCurrency(stats.projectedYearly)}</ProjectionValue>
        <ProjectionDetail>
          Based on {formatCurrency(stats.avgPerOrder)} avg per order &middot; ~{stats.ordersPerMonth.toFixed(1)} orders/month &middot; {stats.totalOrders} total orders
        </ProjectionDetail>
      </Projection>
    </Card>
  )
}
