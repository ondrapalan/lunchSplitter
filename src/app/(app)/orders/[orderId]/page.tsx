'use client'

import { useEffect, useState, use, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import styled from 'styled-components'
import { toast } from 'react-toastify'
import { useLunchSession } from '~/features/lunch/hooks/useLunchSession'
import { useAutoSave } from '~/features/lunch/hooks/useAutoSave'
import { useCalculation } from '~/features/lunch/hooks/useCalculation'
import { OrderSettings } from '~/features/lunch/components/OrderSettings'
import { PeopleSection } from '~/features/lunch/components/PeopleSection'
import { Summary } from '~/features/lunch/components/Summary'

import { Button } from '~/features/ui/components/Button'
import { SectionTitle } from '~/features/ui/components/SectionTitle'
import { StatusBadge } from '~/features/ui/components/StatusBadge'
import { getOrder, deleteOrder, getItemsByRestaurant, closeOrder, reopenOrder, joinOrder } from '~/actions/orders'
import { getRegisteredUsers } from '~/actions/users'
import { wasEdited } from '~/features/lunch/utils/formatters'
import type { UserSuggestion } from '~/features/lunch/components/PersonSuggest'
import type { ItemSuggestion } from '~/features/lunch/components/ItemSuggest'
import type { LunchSession, Item } from '~/features/lunch/types'

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
  onSaved: () => Promise<void>
  onStatusChange: () => Promise<void>
  onJoined: () => Promise<void>
}) {
  const { restaurantName, session: initialSession, isCreator, createdAt, updatedAt, creatorName, status, isParticipant, currentUserPersonId } = orderData
  const router = useRouter()

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

  const autoSave = useAutoSave({
    orderId,
    enabled: isEditing || isEditingMyItems,
  })

  const handleAutoSaveAddItem = useCallback((personId: string, name: string, price: number) => {
    const itemId = crypto.randomUUID()
    addItem(personId, name, price, itemId)
    autoSave.saveAddItem(personId, { id: itemId, name, price, discountPercent: null })
  }, [addItem, autoSave])

  const handleAutoSaveRemoveItem = useCallback((personId: string, itemId: string) => {
    removeItem(personId, itemId)
    autoSave.saveRemoveItem(personId, itemId)
  }, [removeItem, autoSave])

  const handleAutoSaveUpdateItem = useCallback((personId: string, itemId: string, updates: Partial<Omit<Item, 'id'>>) => {
    updateItem(personId, itemId, updates)
    autoSave.debouncedUpdateItem(personId, itemId, updates)
  }, [updateItem, autoSave])

  const handleAutoSaveAddPerson = useCallback((name: string, userId?: string) => {
    const personId = crypto.randomUUID()
    addPerson(name, userId, personId)
    autoSave.saveAddPerson(personId, name, userId)
  }, [addPerson, autoSave])

  const handleAutoSaveRemovePerson = useCallback((personId: string) => {
    removePerson(personId)
    autoSave.saveRemovePerson(personId)
  }, [removePerson, autoSave])

  const handleAutoSaveUpdatePersonName = useCallback((personId: string, name: string) => {
    updatePersonName(personId, name)
    autoSave.saveUpdatePersonName(personId, name)
  }, [updatePersonName, autoSave])

  const { summaries, netFees, feePerPerson, grandTotal } = useCalculation(session)

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

  const handleDelete = async () => {
    if (!confirm('Delete this order?')) return
    try {
      await deleteOrder(orderId)
      toast.success('Order deleted')
      router.push('/orders')
    } catch {
      toast.error('Failed to delete order')
    }
  }

  const wasEditedAfterCreation = wasEdited(createdAt, updatedAt)
  const isClosed = status === 'CLOSED'
  const isOpen = status === 'OPEN'
  const isEmpty = session.people.length === 0
  const showDeleteButton = isCreator && isEmpty

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
            <StatusBadge $status={status} style={{ marginLeft: '8px' }}>{status === 'OPEN' ? 'Open' : 'Closed'}</StatusBadge>
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
          {showDeleteButton && (
            <Button variant="danger" onClick={handleDelete}>Delete Order</Button>
          )}
          {(isEditing || isEditingMyItems) && autoSave.saveStatus !== 'idle' && (
            <SaveStatus>
              {autoSave.saveStatus === 'saving' && 'Saving...'}
              {autoSave.saveStatus === 'saved' && 'All changes saved'}
              {autoSave.saveStatus === 'error' && 'Save failed'}
            </SaveStatus>
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
        onAddPerson={isEditing ? handleAutoSaveAddPerson : addPerson}
        onRemovePerson={isEditing ? handleAutoSaveRemovePerson : removePerson}
        onUpdatePersonName={isEditing ? handleAutoSaveUpdatePersonName : updatePersonName}
        onAddItem={isEditing || isEditingMyItems ? handleAutoSaveAddItem : addItem}
        onUpdateItem={isEditing || isEditingMyItems ? handleAutoSaveUpdateItem : updateItem}
        onRemoveItem={isEditing || isEditingMyItems ? handleAutoSaveRemoveItem : removeItem}
        onFlushItem={(isEditing || isEditingMyItems)
          ? (_personId: string, itemId: string) => autoSave.flushUpdateItem(itemId)
          : undefined
        }
      />

      <Summary summaries={summaries} grandTotal={grandTotal} />

      {(isEditing || isEditingMyItems) && (
        <SaveBar>
          <Button variant="primary" onClick={async () => {
            autoSave.flushAll()
            await onSaved()
          }}>
            Done
          </Button>
        </SaveBar>
      )}
    </div>
  )
}
