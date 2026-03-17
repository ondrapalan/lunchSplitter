'use client'

import { useEffect, useState, use, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import styled from 'styled-components'
import { toast } from 'react-toastify'
import { useLunchSession } from '~/features/lunch/hooks/useLunchSession'
import { useCalculation } from '~/features/lunch/hooks/useCalculation'
import { OrderSettings } from '~/features/lunch/components/OrderSettings'
import { PeopleSection } from '~/features/lunch/components/PeopleSection'
import { Summary } from '~/features/lunch/components/Summary'

import { Button } from '~/features/ui/components/Button'
import { SectionTitle } from '~/features/ui/components/SectionTitle'
import { getOrder, saveOrder, getItemsByRestaurant, closeOrder, reopenOrder, joinOrder, saveMyItems } from '~/actions/orders'
import { getRegisteredUsers } from '~/actions/users'
import { wasEdited } from '~/features/lunch/utils/formatters'
import type { UserSuggestion } from '~/features/lunch/components/PersonSuggest'
import type { ItemSuggestion } from '~/features/lunch/components/ItemSuggest'
import type { LunchSession } from '~/features/lunch/types'

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`

const SaveBar = styled.div`
  display: flex;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.md};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`

const SaveStatus = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`

const LastEdited = styled.div`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  margin-top: ${({ theme }) => theme.spacing.xs};
`

const StatusBadge = styled.span<{ $status: 'OPEN' | 'CLOSED' }>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 500;
  margin-left: ${({ theme }) => theme.spacing.sm};
  background: ${({ $status }) =>
    $status === 'OPEN' ? 'rgba(129, 199, 132, 0.15)' : 'rgba(144, 164, 174, 0.15)'};
  color: ${({ $status, theme }) =>
    $status === 'OPEN' ? theme.colors.positive : theme.colors.secondary};
`

const HeaderActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: center;
`

interface OrderData {
  restaurantName: string
  session: LunchSession
  isCreator: boolean
  createdAt: string
  updatedAt: string
  creatorName: string
  status: 'OPEN' | 'CLOSED'
  isParticipant: boolean
  currentUserPersonId: string | null
}

export default function OrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params)
  const router = useRouter()
  const [loaded, setLoaded] = useState(false)
  const [orderData, setOrderData] = useState<OrderData | null>(null)
  const [registeredUsers, setRegisteredUsers] = useState<UserSuggestion[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [isEditingMyItems, setIsEditingMyItems] = useState(false)
  const [contentKey, setContentKey] = useState(0)
  const [historicalItems, setHistoricalItems] = useState<ItemSuggestion[]>([])

  const load = useCallback(async () => {
    try {
      const [result, users] = await Promise.all([getOrder(orderId), getRegisteredUsers()])
      setRegisteredUsers(users)
      if (!result) {
        toast.error('Order not found')
        router.push('/orders')
        return
      }
      setOrderData(result)
      getItemsByRestaurant(result.restaurantName).then(setHistoricalItems)
      setLoaded(true)
      if (result.session.people.length === 0 && result.isCreator) {
        setIsEditing(true)
      }
    } catch {
      toast.error('Failed to load order')
    }
  }, [orderId, router])

  useEffect(() => {
    load()
  }, [load])

  if (!loaded || !orderData) {
    return <SectionTitle>Loading order...</SectionTitle>
  }

  return (
    <OrderContent
      key={contentKey}
      orderId={orderId}
      orderData={orderData}
      registeredUsers={registeredUsers}
      historicalItemSuggestions={historicalItems}
      isEditing={isEditing}
      isEditingMyItems={isEditingMyItems}
      onEdit={() => setIsEditing(true)}
      onEditMyItems={() => setIsEditingMyItems(true)}
      onCancel={async () => {
        setIsEditing(false)
        setIsEditingMyItems(false)
        await load()
        setContentKey(k => k + 1)
      }}
      onSaved={async () => {
        setIsEditing(false)
        setIsEditingMyItems(false)
        await load()
        setContentKey(k => k + 1)
      }}
      onStatusChange={async () => {
        await load()
        setContentKey(k => k + 1)
      }}
      onJoined={async () => {
        await load()
        setIsEditingMyItems(true)
        setContentKey(k => k + 1)
      }}
    />
  )
}

function OrderContent({
  orderId,
  orderData,
  registeredUsers,
  historicalItemSuggestions,
  isEditing,
  isEditingMyItems,
  onEdit,
  onEditMyItems,
  onCancel,
  onSaved,
  onStatusChange,
  onJoined,
}: {
  orderId: string
  orderData: OrderData
  registeredUsers: UserSuggestion[]
  historicalItemSuggestions: ItemSuggestion[]
  isEditing: boolean
  isEditingMyItems: boolean
  onEdit: () => void
  onEditMyItems: () => void
  onCancel: () => Promise<void>
  onSaved: () => Promise<void>
  onStatusChange: () => Promise<void>
  onJoined: () => Promise<void>
}) {
  const { restaurantName, session: initialSession, isCreator, createdAt, updatedAt, creatorName, status, isParticipant, currentUserPersonId } = orderData
  const [saving, setSaving] = useState(false)

  const {
    session,
    setGlobalDiscount,
    addFeeAdjustment,
    updateFeeAdjustment,
    removeFeeAdjustment,
    addPerson,
    removePerson,
    updatePersonName,
    addItem,
    updateItem,
    removeItem,
  } = useLunchSession(initialSession)

  const { summaries, netFees, feePerPerson, grandTotal } = useCalculation(session)

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveOrder(orderId, session, updatedAt)
      toast.success('Order saved!')
      await onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save order')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveMyItems = async () => {
    if (!currentUserPersonId) return
    setSaving(true)
    try {
      const myPerson = session.people.find(p => p.id === currentUserPersonId)
      if (!myPerson) throw new Error('Could not find your items')
      await saveMyItems(orderId, currentUserPersonId, myPerson.items, updatedAt)
      toast.success('Items saved!')
      await onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save items')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = async () => {
    try {
      await closeOrder(orderId)
      toast.success('Order closed')
      await onStatusChange()
    } catch {
      toast.error('Failed to close order')
    }
  }

  const handleReopen = async () => {
    try {
      await reopenOrder(orderId)
      toast.success('Order reopened')
      await onStatusChange()
    } catch {
      toast.error('Failed to reopen order')
    }
  }

  const handleJoin = async () => {
    try {
      await joinOrder(orderId)
      toast.success('Joined order!')
      await onJoined()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to join order')
    }
  }

  const wasEditedAfterCreation = wasEdited(createdAt, updatedAt)
  const isClosed = status === 'CLOSED'
  const isOpen = status === 'OPEN'

  const showCreatorEditButton = isCreator && isOpen && !isEditing
  const showJoinButton = !isCreator && !isParticipant && isOpen
  const showCloseButton = isCreator && isOpen && !isEditing
  const showReopenButton = isCreator && isClosed
  const showEditMyItemsForPersonId = (!isCreator && isParticipant && isOpen && !isEditingMyItems)
    ? currentUserPersonId
    : null

  return (
    <div>
      <Header>
        <div>
          <SectionTitle style={{ marginBottom: 0 }}>
            {restaurantName}
            <StatusBadge $status={status}>{status === 'OPEN' ? 'Open' : 'Closed'}</StatusBadge>
          </SectionTitle>
          {!isCreator && (
            <LastEdited>Created by {creatorName}</LastEdited>
          )}
          {wasEditedAfterCreation && (
            <LastEdited>Last edited: {new Date(updatedAt).toLocaleDateString()}</LastEdited>
          )}
        </div>
        <HeaderActions>
          {showCloseButton && (
            <Button variant="secondary" onClick={handleClose}>Close Order</Button>
          )}
          {showReopenButton && (
            <Button variant="secondary" onClick={handleReopen}>Reopen Order</Button>
          )}
          {showCreatorEditButton && (
            <Button variant="primary" onClick={onEdit}>Edit order details</Button>
          )}
          {showJoinButton && (
            <Button variant="primary" onClick={handleJoin}>Join This Order</Button>
          )}
          {(isEditing || isEditingMyItems) && (
            <SaveStatus>{saving ? 'Saving...' : ''}</SaveStatus>
          )}
        </HeaderActions>
      </Header>

      <OrderSettings
        globalDiscountPercent={session.globalDiscountPercent}
        feeAdjustments={session.feeAdjustments}
        netFees={netFees}
        feePerPerson={feePerPerson}
        peopleCount={session.people.length}
        editable={isEditing}
        onSetGlobalDiscount={setGlobalDiscount}
        onAddFee={addFeeAdjustment}
        onUpdateFee={updateFeeAdjustment}
        onRemoveFee={removeFeeAdjustment}
      />

      <PeopleSection
        people={session.people}
        summaries={summaries}
        globalDiscountPercent={session.globalDiscountPercent}
        registeredUsers={registeredUsers}
        historicalItemSuggestions={historicalItemSuggestions}
        canAddPerson={isEditing}
        canEditItems={isEditing}
        canEditNames={isEditing}
        canRemovePeople={isEditing}
        hideShareControls={isEditingMyItems}
        editablePersonId={isEditingMyItems ? currentUserPersonId : null}
        showEditMyItemsForPersonId={showEditMyItemsForPersonId}
        onEditMyItems={onEditMyItems}
        onAddPerson={addPerson}
        onRemovePerson={removePerson}
        onUpdatePersonName={updatePersonName}
        onAddItem={addItem}
        onUpdateItem={updateItem}
        onRemoveItem={removeItem}
      />

      <Summary summaries={summaries} grandTotal={grandTotal} />

      {isEditing && (
        <SaveBar>
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </SaveBar>
      )}

      {isEditingMyItems && (
        <SaveBar>
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveMyItems} disabled={saving}>
            {saving ? 'Saving...' : 'Save My Items'}
          </Button>
        </SaveBar>
      )}
    </div>
  )
}
