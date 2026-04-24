'use client'

import { useQuery } from '@tanstack/react-query'
import { getStatsBundle, type StatsBundle } from '~/actions/stats'
import type { StatPeriod } from '~/features/stats/types'
import { qk } from '~/lib/queries/keys'

export function useStatsBundle<TSlice = StatsBundle>(
  period: StatPeriod,
  select?: (bundle: StatsBundle) => TSlice,
) {
  return useQuery({
    queryKey: qk.stats.bundle(period),
    queryFn: () => getStatsBundle(period),
    staleTime: 60_000,
    select,
  })
}
