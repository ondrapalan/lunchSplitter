'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import styled from 'styled-components'
import { toast } from 'react-toastify'
import { Button } from '~/features/ui/components/Button'
import { SectionTitle } from '~/features/ui/components/SectionTitle'
import { StatusBadge } from '~/features/ui/components/StatusBadge'
import {
  useAdminOrders,
  useDeleteOrder,
  useJoinOrder,
  useMyOrders,
  useOpenOrders,
  useReopenOrder,
} from '~/lib/queries/orders'
import { AdminBadge } from '~/features/ui/components/AdminBadge'
import { wasEdited } from '~/features/lunch/utils/formatters'
import { QrPlatba } from '~/features/lunch/components/QrPlatba'
import { buildSpdString, czechAccountToIban, generateVariableSymbol } from '~/features/lunch/utils/qrPlatba'
import { Skeleton, SkeletonTitle } from '~/features/ui/components/Skeleton'
import { useConfirm } from '~/features/ui/components/ConfirmDialog'

interface BaseOrderListItem {
  id: string
  restaurantName: string
  createdAt: string
  updatedAt: string
  isCreator: boolean
  creatorName: string
  peopleCount: number
}

interface OrderListItem extends BaseOrderListItem {
  bankAccountNumber: string | null
  myPersonId: string | null
  myAmount: number | null
  paymentStatus: { paid: number; total: number } | null
}


const OrderList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`

const OrderRow = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  transition: border-color 0.15s ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`

const RowLink = styled(Link)`
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: inherit;
  cursor: pointer;
  /* Keyboard focus ring sits inside the row */
  outline-offset: -2px;
`

const OrderInfo = styled.div`
  flex: 1;
  min-width: 0;
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

const NameText = styled.span`
  min-width: 0;
`

const Actions = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: center;
  flex-shrink: 0;
`

const PaymentStatus = styled.span<{ $allPaid: boolean }>`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 500;
  color: ${({ $allPaid, theme }) => $allPaid ? theme.colors.positive : theme.colors.warning};
  white-space: nowrap;
`

function OrderQrCode({ order }: { order: OrderListItem }) {
  if (order.isCreator || !order.bankAccountNumber || !order.myPersonId || !order.myAmount || order.myAmount <= 0) {
    return null
  }
  try {
    const iban = czechAccountToIban(order.bankAccountNumber)
    const variableSymbol = generateVariableSymbol(order.id, order.myPersonId)
    const spdString = buildSpdString({
      iban,
      amount: order.myAmount,
      variableSymbol,
      message: order.restaurantName,
    })
    return <QrPlatba spdString={spdString} amount={order.myAmount} size={64} />
  } catch {
    return null
  }
}

const OrderListRow = styled(Skeleton).attrs({ $height: '72px' })`
  margin-bottom: 0;
`

export default function OrdersPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'

  const openQuery = useOpenOrders()
  const myQuery = useMyOrders()
  const adminQuery = useAdminOrders(isAdmin)

  const deleteMutation = useDeleteOrder()
  const reopenMutation = useReopenOrder()
  const joinMutation = useJoinOrder()
  const confirm = useConfirm()

  const openOrders = openQuery.data ?? []
  const closedOrders = myQuery.data ?? []
  const adminOrders = adminQuery.data ?? []

  const anyError = openQuery.error || myQuery.error
  useEffect(() => {
    if (anyError) toast.error('Failed to load orders')
  }, [anyError])

  const isPending = openQuery.isPending || myQuery.isPending || (isAdmin && adminQuery.isPending)

  const handleDelete = async (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation()
    if (!await confirm({ title: 'Delete this order?', variant: 'danger', confirmLabel: 'Delete' })) return
    try {
      await deleteMutation.mutateAsync(orderId)
      toast.success('Order deleted')
    } catch {
      toast.error('Failed to delete order')
    }
  }

  const handleReopen = async (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation()
    try {
      await reopenMutation.mutateAsync(orderId)
      toast.success('Order reopened')
    } catch {
      toast.error('Failed to reopen order')
    }
  }

  const handleJoin = async (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation()
    try {
      await joinMutation.mutateAsync(orderId)
      toast.success('Joined order!')
      router.push(`/orders/${orderId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to join order')
    }
  }

  if (isPending) {
    return (
      <div>
        <SkeletonTitle />
        <OrderList>
          <OrderListRow />
          <OrderListRow />
          <OrderListRow />
        </OrderList>
      </div>
    )
  }

  const isEmpty = openOrders.length === 0 && closedOrders.length === 0 && adminOrders.length === 0

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
          <SectionTitle>Active Orders</SectionTitle>
          <OrderList>
            {openOrders.map(order => (
              <OrderRow key={order.id}>
                <RowLink href={`/orders/${order.id}`} aria-label={`Open order at ${order.restaurantName}`} />
                <OrderInfo>
                  <RestaurantName>
                    <NameText>{order.restaurantName}</NameText>
                    <StatusBadge $status="OPEN">Open</StatusBadge>
                  </RestaurantName>
                  <OrderMeta>
                    {!order.isCreator && <>by {order.creatorName} &middot; </>}
                    {new Date(order.createdAt).toLocaleDateString()} &middot; {order.peopleCount} people
                  </OrderMeta>
                </OrderInfo>
                <Actions>
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
              <OrderRow key={order.id}>
                <RowLink href={`/orders/${order.id}`} aria-label={`Open order at ${order.restaurantName}`} />
                <OrderInfo>
                  <RestaurantName>
                    <NameText>{order.restaurantName}</NameText>
                    <StatusBadge $status="CLOSED">Closed</StatusBadge>
                  </RestaurantName>
                  <OrderMeta>
                    {!order.isCreator && <>by {order.creatorName} &middot; </>}
                    {new Date(order.createdAt).toLocaleDateString()} &middot; {order.peopleCount} people
                    {wasEdited(order.createdAt, order.updatedAt) && (
                      <> &middot; Last edited: {new Date(order.updatedAt).toLocaleDateString()}</>
                    )}
                    {order.paymentStatus && order.paymentStatus.total > 0 && (
                      <> &middot; <PaymentStatus $allPaid={order.paymentStatus.paid === order.paymentStatus.total}>
                        {order.paymentStatus.paid}/{order.paymentStatus.total} paid
                      </PaymentStatus></>
                    )}
                  </OrderMeta>
                </OrderInfo>
                <OrderQrCode order={order} />
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

      {isAdmin && adminOrders.length > 0 && (
        <>
          <SectionTitle>
            All Orders <AdminBadge>Admin</AdminBadge>
          </SectionTitle>
          <OrderList>
            {adminOrders.map(order => (
              <OrderRow key={order.id}>
                <RowLink href={`/orders/${order.id}`} aria-label={`Open order at ${order.restaurantName}`} />
                <OrderInfo>
                  <RestaurantName>
                    <NameText>{order.restaurantName}</NameText>
                    <StatusBadge $status="CLOSED">Closed</StatusBadge>
                  </RestaurantName>
                  <OrderMeta>
                    by {order.creatorName} &middot; {new Date(order.createdAt).toLocaleDateString()} &middot; {order.peopleCount} people
                    {wasEdited(order.createdAt, order.updatedAt) && (
                      <> &middot; Last edited: {new Date(order.updatedAt).toLocaleDateString()}</>
                    )}
                  </OrderMeta>
                </OrderInfo>
                <Actions>
                  <Button variant="secondary" size="sm" onClick={e => handleReopen(e, order.id)}>
                    Reopen
                  </Button>
                  <Button variant="danger" size="sm" onClick={e => handleDelete(e, order.id)}>
                    Delete
                  </Button>
                </Actions>
              </OrderRow>
            ))}
          </OrderList>
        </>
      )}
    </div>
  )
}
