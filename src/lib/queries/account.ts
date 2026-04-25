'use client'

import { useQuery } from '@tanstack/react-query'
import { getBankAccount } from '~/actions/auth'
import { qk } from '~/lib/queries/keys'

export function useBankAccount() {
  return useQuery({
    queryKey: qk.account.bankAccount(),
    queryFn: () => getBankAccount(),
    staleTime: 5 * 60_000,
  })
}
