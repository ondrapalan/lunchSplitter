'use client'

import styled from 'styled-components'
import { SectionTitle } from '~/features/ui/components/SectionTitle'
import { SpendingLeaderboard } from '~/features/stats/components/SpendingLeaderboard'
import { OrderFrequency } from '~/features/stats/components/OrderFrequency'
import { PersonalPrediction } from '~/features/stats/components/PersonalPrediction'
import { FunStats } from '~/features/stats/components/FunStats'
import { VisitorsSection } from '~/features/stats/components/VisitorsSection'
import { SekackaStats } from '~/features/stats/components/SekackaStats'

const SectionGap = styled.div`
  margin-top: ${({ theme }) => theme.spacing.lg};
`

export default function StatsPage() {
  return (
    <div>
      <SectionTitle>Statistics</SectionTitle>
      <PersonalPrediction />
      <SectionGap />
      <SpendingLeaderboard />
      <SectionGap />
      <OrderFrequency />
      <SectionGap />
      <FunStats />
      <SectionGap />
      <SekackaStats />
      <SectionGap />
      <VisitorsSection />
    </div>
  )
}
