'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import styled from 'styled-components'
import { toast } from 'react-toastify'
import { Button } from '~/features/ui/components/Button'
import { SectionTitle } from '~/features/ui/components/SectionTitle'
import { listOrders, deleteOrder } from '~/actions/orders'

interface OrderListItem {
  id: string
  restaurantName: string
  createdAt: string
  peopleCount: number
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

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<OrderListItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadOrders = async () => {
    const result = await listOrders()
    setOrders(result)
    setLoading(false)
  }

  useEffect(() => {
    loadOrders()
  }, [])

  const handleDelete = async (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation()
    if (!confirm('Delete this order?')) return
    await deleteOrder(orderId)
    toast.success('Order deleted')
    loadOrders()
  }

  if (loading) {
    return <SectionTitle>Loading orders...</SectionTitle>
  }

  return (
    <div>
      <SectionTitle>Order History</SectionTitle>
      {orders.length === 0 ? (
        <EmptyState>
          No orders yet. Create your first order!
        </EmptyState>
      ) : (
        <OrderList>
          {orders.map(order => (
            <OrderRow key={order.id} onClick={() => router.push(`/orders/${order.id}`)}>
              <OrderInfo>
                <RestaurantName>{order.restaurantName}</RestaurantName>
                <OrderMeta>
                  {new Date(order.createdAt).toLocaleDateString()} &middot; {order.peopleCount} people
                </OrderMeta>
              </OrderInfo>
              <Button variant="danger" size="sm" onClick={e => handleDelete(e, order.id)}>
                Delete
              </Button>
            </OrderRow>
          ))}
        </OrderList>
      )}
    </div>
  )
}
