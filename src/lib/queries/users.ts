'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteUser,
  getRegisteredUsers,
  listUsers,
  setUserDiscordId,
  updateUserAliases,
} from '~/actions/users'
import { qk } from '~/lib/queries/keys'

export function useRegisteredUsers() {
  return useQuery({
    queryKey: qk.users.registered(),
    queryFn: () => getRegisteredUsers(),
    staleTime: 5 * 60_000,
  })
}

export function useAdminUsersList(enabled = true) {
  return useQuery({
    queryKey: qk.users.list(),
    queryFn: () => listUsers(),
    enabled,
    staleTime: 60_000,
  })
}

function useInvalidateUsers() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: qk.users.all })
  }
}

export function useDeleteUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: (userId: string) => deleteUser(userId),
    onSuccess: invalidate,
  })
}

export function useUpdateUserAliases() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: (input: { userId: string; aliases: string[] }) =>
      updateUserAliases(input.userId, input.aliases),
    onSuccess: invalidate,
  })
}

export function useSetUserDiscordId() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: (input: { userId: string; discordId: string | null }) =>
      setUserDiscordId(input.userId, input.discordId),
    onSuccess: invalidate,
  })
}
