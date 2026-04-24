'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  closeOrder,
  createOrder,
  deleteOrder,
  getItemsByRestaurant,
  getOrder,
  getRestaurantNames,
  joinOrder,
  leaveOrder,
  listAdminOrders,
  listOpenOrders,
  listOrders,
  reopenOrder,
  saveMyItems,
  saveOrder,
} from '~/actions/orders'
import { qk } from '~/lib/queries/keys'

export function useOpenOrders() {
  return useQuery({
    queryKey: qk.orders.open(),
    queryFn: () => listOpenOrders(),
  })
}

export function useMyOrders() {
  return useQuery({
    queryKey: qk.orders.my(),
    queryFn: () => listOrders(),
  })
}

export function useAdminOrders(enabled: boolean) {
  return useQuery({
    queryKey: qk.orders.admin(),
    queryFn: () => listAdminOrders(),
    enabled,
    retry: false,
  })
}

export function useOrder(orderId: string) {
  return useQuery({
    queryKey: qk.orders.byId(orderId),
    queryFn: () => getOrder(orderId),
    enabled: !!orderId,
  })
}

export function useItemsByRestaurant(restaurantName: string | undefined) {
  return useQuery({
    queryKey: restaurantName
      ? qk.orders.itemsByRestaurant(restaurantName)
      : ['orders', 'items', 'none'],
    queryFn: () => getItemsByRestaurant(restaurantName as string),
    enabled: !!restaurantName,
    staleTime: 5 * 60_000,
  })
}

export function useRestaurantNames() {
  return useQuery({
    queryKey: qk.orders.restaurantNames(),
    queryFn: () => getRestaurantNames(),
    staleTime: 5 * 60_000,
  })
}

function useInvalidateOrders() {
  const qc = useQueryClient()
  return (orderId?: string) => {
    qc.invalidateQueries({ queryKey: qk.orders.all })
    qc.invalidateQueries({ queryKey: qk.stats.all })
    if (orderId) qc.invalidateQueries({ queryKey: qk.orders.byId(orderId) })
  }
}

export function useCreateOrder() {
  const invalidate = useInvalidateOrders()
  return useMutation({
    mutationFn: (input: { restaurantName: string; bankAccountNumber?: string }) =>
      createOrder(input.restaurantName, input.bankAccountNumber),
    onSuccess: () => invalidate(),
  })
}

export function useSaveOrder() {
  const invalidate = useInvalidateOrders()
  return useMutation({
    mutationFn: (input: Parameters<typeof saveOrder>) => saveOrder(...input),
    onSuccess: (_d, [orderId]) => invalidate(orderId),
  })
}

export function useDeleteOrder() {
  const invalidate = useInvalidateOrders()
  return useMutation({
    mutationFn: (orderId: string) => deleteOrder(orderId),
    onSuccess: (_d, orderId) => invalidate(orderId),
  })
}

export function useCloseOrder() {
  const invalidate = useInvalidateOrders()
  return useMutation({
    mutationFn: (input: { orderId: string; sendDiscord?: boolean }) =>
      closeOrder(input.orderId, { sendDiscord: input.sendDiscord }),
    onSuccess: (_d, { orderId }) => invalidate(orderId),
  })
}

export function useReopenOrder() {
  const invalidate = useInvalidateOrders()
  return useMutation({
    mutationFn: (orderId: string) => reopenOrder(orderId),
    onSuccess: (_d, orderId) => invalidate(orderId),
  })
}

export function useJoinOrder() {
  const invalidate = useInvalidateOrders()
  return useMutation({
    mutationFn: (orderId: string) => joinOrder(orderId),
    onSuccess: (_d, orderId) => invalidate(orderId),
  })
}

export function useLeaveOrder() {
  const invalidate = useInvalidateOrders()
  return useMutation({
    mutationFn: (orderId: string) => leaveOrder(orderId),
    onSuccess: (_d, orderId) => invalidate(orderId),
  })
}

export function useSaveMyItems() {
  const invalidate = useInvalidateOrders()
  return useMutation({
    mutationFn: (input: Parameters<typeof saveMyItems>) => saveMyItems(...input),
    onSuccess: (_d, [orderId]) => invalidate(orderId),
  })
}
