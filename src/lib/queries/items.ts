'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listItemNameUsage, bulkMarkPackaging } from '~/actions/items'
import { qk } from '~/lib/queries/keys'

export function useItemNameUsage() {
  return useQuery({
    queryKey: qk.items.nameUsage(),
    queryFn: () => listItemNameUsage(),
    staleTime: 60_000,
  })
}

export function useBulkMarkPackaging() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { names: string[]; isPackaging: boolean }) =>
      bulkMarkPackaging(input.names, input.isPackaging),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.items.all })
      qc.invalidateQueries({ queryKey: qk.orders.all })
      qc.invalidateQueries({ queryKey: qk.stats.all })
    },
  })
}
