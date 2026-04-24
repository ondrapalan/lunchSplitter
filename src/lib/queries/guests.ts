'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  backfillLegacyGuest,
  createGuest,
  deleteGuest,
  listGuests,
  listGuestsWithStats,
  listLegacyGuestNames,
  updateGuest,
} from '~/actions/guests'
import { qk } from '~/lib/queries/keys'

export function useGuests() {
  return useQuery({
    queryKey: qk.guests.list(),
    queryFn: () => listGuests(),
    staleTime: 5 * 60_000,
  })
}

export function useGuestsWithStats() {
  return useQuery({
    queryKey: qk.guests.withStats(),
    queryFn: () => listGuestsWithStats(),
    staleTime: 60_000,
  })
}

export function useLegacyGuestNames(enabled = true) {
  return useQuery({
    queryKey: qk.guests.legacyNames(),
    queryFn: () => listLegacyGuestNames(),
    enabled,
    staleTime: 60_000,
  })
}

function useInvalidateGuests() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: qk.guests.all })
    qc.invalidateQueries({ queryKey: qk.orders.all })
    qc.invalidateQueries({ queryKey: qk.stats.all })
  }
}

export function useCreateGuest() {
  const invalidate = useInvalidateGuests()
  return useMutation({
    mutationFn: (input: Parameters<typeof createGuest>[0]) => createGuest(input),
    onSuccess: invalidate,
  })
}

export function useUpdateGuest() {
  const invalidate = useInvalidateGuests()
  return useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof updateGuest>[1] }) =>
      updateGuest(input.id, input.patch),
    onSuccess: invalidate,
  })
}

export function useDeleteGuest() {
  const invalidate = useInvalidateGuests()
  return useMutation({
    mutationFn: (id: string) => deleteGuest(id),
    onSuccess: invalidate,
  })
}

export function useBackfillLegacyGuest() {
  const invalidate = useInvalidateGuests()
  return useMutation({
    mutationFn: (input: Parameters<typeof backfillLegacyGuest>[0]) => backfillLegacyGuest(input),
    onSuccess: invalidate,
  })
}
