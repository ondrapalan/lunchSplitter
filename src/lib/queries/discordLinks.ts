'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  dismissPendingDiscordLink,
  getUsersWithoutDiscordLink,
  listPendingDiscordLinks,
  resolvePendingDiscordLinkCreateUser,
  resolvePendingDiscordLinkToUser,
} from '~/actions/pendingDiscordLinks'
import { listUnlinkedGuildMembers } from '~/actions/discordMembers'
import { qk } from '~/lib/queries/keys'

export function usePendingDiscordLinks() {
  return useQuery({
    queryKey: qk.discordLinks.pending(),
    queryFn: () => listPendingDiscordLinks(),
    staleTime: 30_000,
  })
}

export function useUsersWithoutDiscordLink() {
  return useQuery({
    queryKey: qk.discordLinks.pickableUsers(),
    queryFn: () => getUsersWithoutDiscordLink(),
    staleTime: 60_000,
  })
}

export function useUnlinkedDiscordMembers() {
  return useQuery({
    queryKey: qk.discordLinks.members(),
    queryFn: () => listUnlinkedGuildMembers(),
    staleTime: 60_000,
  })
}

function useInvalidateDiscordLinks() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: qk.discordLinks.all })
    qc.invalidateQueries({ queryKey: qk.users.all })
  }
}

export function useResolvePendingLinkToUser() {
  const invalidate = useInvalidateDiscordLinks()
  return useMutation({
    mutationFn: (input: { linkId: string; userId: string }) =>
      resolvePendingDiscordLinkToUser(input.linkId, input.userId),
    onSuccess: invalidate,
  })
}

export function useResolvePendingLinkCreateUser() {
  const invalidate = useInvalidateDiscordLinks()
  return useMutation({
    mutationFn: (input: {
      linkId: string
      data: { username: string; displayName: string; role: 'ADMIN' | 'USER' }
    }) => resolvePendingDiscordLinkCreateUser(input.linkId, input.data),
    onSuccess: invalidate,
  })
}

export function useDismissPendingLink() {
  const invalidate = useInvalidateDiscordLinks()
  return useMutation({
    mutationFn: (linkId: string) => dismissPendingDiscordLink(linkId),
    onSuccess: invalidate,
  })
}
