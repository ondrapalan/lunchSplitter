'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import styled from 'styled-components'
import { toast } from 'react-toastify'
import { Button } from '~/features/ui/components/Button'
import { SectionTitle } from '~/features/ui/components/SectionTitle'
import { listOrders, listOpenOrders, deleteOrder, closeOrder, reopenOrder, joinOrder } from '~/actions/orders'
import { wasEdited } from '~/features/lunch/utils/formatters'

interface OrderListItem {
  id: string
  restaurantName: string
  createdAt: string
  updatedAt: string
  isCreator: boolean
  creatorName: string
  peopleCount: number
}

interface OpenOrderListItem extends OrderListItem {
  isParticipant: boolean
}

const OrderList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`

const OrderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  cursor: pointer;
  transition: border-color 0.15s ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`

const OrderInfo = styled.div`
  flex: 1;
`

const RestaurantName = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.colors.text};
  font-weight: 500;
`

const OrderMeta = styled.div`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`

const EmptyState = styled.div`
  text-align: center;
  color: ${({ theme }) => theme.colors.textMuted};
  padding: ${({ theme }) => theme.spacing.xl};
`

const CreatorBadge = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
  font-weight: 400;
  font-size: ${({ theme }) => theme.fontSizes.sm};
`

const StatusBadge = styled.span<{ $status: 'OPEN' | 'CLOSED' }>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 500;
  background: ${({ $status }) =>
    $status === 'OPEN' ? 'rgba(129, 199, 132, 0.15)' : 'rgba(144, 164, 174, 0.15)'};
  color: ${({ $status, theme }) =>
    $status === 'OPEN' ? theme.colors.positive : theme.colors.secondary};
`

const Actions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: center;
`

export default function OrdersPage() {
  const router = useRouter()
  const [openOrders, setOpenOrders] = useState<OpenOrderListItem[]>([])
  const [closedOrders, setClosedOrders] = useState<OrderListItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadOrders = useCallback(async () => {
    const [open, closed] = await Promise.all([listOpenOrders(), listOrders()])
    setOpenOrders(open)
    setClosedOrders(closed)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  const handleDelete = async (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation()
    if (!confirm('Delete this order?')) return
    try {
      await deleteOrder(orderId)
      toast.success('Order deleted')
      loadOrders()
    } catch {
      toast.error('Failed to delete order')
    }
  }

  const handleClose = async (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation()
    try {
      await closeOrder(orderId)
      toast.success('Order closed')
      loadOrders()
    } catch {
      toast.error('Failed to close order')
    }
  }

  const handleReopen = async (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation()
    try {
      await reopenOrder(orderId)
      toast.success('Order reopened')
      loadOrders()
    } catch {
      toast.error('Failed to reopen order')
    }
  }

  const handleJoin = async (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation()
    try {
      await joinOrder(orderId)
      toast.success('Joined order!')
      router.push(`/orders/${orderId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to join order')
    }
  }

  if (loading) {
    return <SectionTitle>Loading orders...</SectionTitle>
  }

  const isEmpty = openOrders.length === 0 && closedOrders.length === 0

  if (isEmpty) {
    return (
      <div>
        <SectionTitle>Orders</SectionTitle>
        <EmptyState>No orders yet. Create your first order!</EmptyState>
      </div>
    )
  }

  return (
    <div>
      {openOrders.length > 0 && (
        <>
          <SectionTitle>Open Orders</SectionTitle>
          <OrderList>
            {openOrders.map(order => (
              <OrderRow key={order.id} onClick={() => router.push(`/orders/${order.id}`)}>
                <OrderInfo>
                  <RestaurantName>
                    {order.restaurantName}
                    <StatusBadge $status="OPEN">Open</StatusBadge>
                    {!order.isCreator && (
                      <CreatorBadge>by {order.creatorName}</CreatorBadge>
                    )}
                  </RestaurantName>
                  <OrderMeta>
                    {new Date(order.createdAt).toLocaleDateString()} &middot; {order.peopleCount} people
                  </OrderMeta>
                </OrderInfo>
                <Actions>
                  {order.isCreator && (
                    <Button variant="secondary" size="sm" onClick={e => handleClose(e, order.id)}>
                      Close
                    </Button>
                  )}
                  {!order.isCreator && !order.isParticipant && (
                    <Button variant="primary" size="sm" onClick={e => handleJoin(e, order.id)}>
                      Join
                    </Button>
                  )}
                </Actions>
              </OrderRow>
            ))}
          </OrderList>
        </>
      )}

      {closedOrders.length > 0 && (
        <>
          <SectionTitle>My Orders</SectionTitle>
          <OrderList>
            {closedOrders.map(order => (
              <OrderRow key={order.id} onClick={() => router.push(`/orders/${order.id}`)}>
                <OrderInfo>
                  <RestaurantName>
                    {order.restaurantName}
                    <StatusBadge $status="CLOSED">Closed</StatusBadge>
                    {!order.isCreator && (
                      <CreatorBadge>by {order.creatorName}</CreatorBadge>
                    )}
                  </RestaurantName>
                  <OrderMeta>
                    {new Date(order.createdAt).toLocaleDateString()} &middot; {order.peopleCount} people
                    {wasEdited(order.createdAt, order.updatedAt) && (
                      <> &middot; Last edited: {new Date(order.updatedAt).toLocaleDateString()}</>
                    )}
                  </OrderMeta>
                </OrderInfo>
                <Actions>
                  {order.isCreator && (
                    <>
                      <Button variant="secondary" size="sm" onClick={e => handleReopen(e, order.id)}>
                        Reopen
                      </Button>
                      <Button variant="danger" size="sm" onClick={e => handleDelete(e, order.id)}>
                        Delete
                      </Button>
                    </>
                  )}
                </Actions>
              </OrderRow>
            ))}
          </OrderList>
        </>
      )}
    </div>
  )
}
