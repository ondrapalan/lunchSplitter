'use client'

import { useEffect, useState, use, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import styled from 'styled-components'
import { media } from '~/features/ui/theme'
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
import { AdminBadge } from '~/features/ui/components/AdminBadge'
import { getOrder, saveOrder, deleteOrder, getItemsByRestaurant, closeOrder, reopenOrder, joinOrder, leaveOrder } from '~/actions/orders'
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

  ${media.mobile} {
    flex-direction: column;
    align-items: flex-start;
    gap: ${({ theme }) => theme.spacing.sm};
  }
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

  ${media.mobile} {
    flex-wrap: wrap;
    width: 100%;
  }
`

interface OrderAccess {
  canView: boolean
  canEdit: boolean
  canEditMyItems: boolean
  canJoin: boolean
  canLeave: boolean
  canClose: boolean
  canReopen: boolean
  canDelete: boolean
  isCreator: boolean
  isParticipant: boolean
  isAdminView: boolean
  currentUserPersonId: string | null
}

interface OrderData {
  restaurantName: string
  session: LunchSession
  createdAt: string
  updatedAt: string
  creatorName: string
  status: 'OPEN' | 'CLOSED'
  bankAccountNumber: string | null
  creatorBankAccount: string | null
  createdById: string
  access: OrderAccess
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
      if (result.session.people.length === 0 && result.access.isCreator) {
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
  const { restaurantName, session: initialSession, createdAt, updatedAt, creatorName, status, bankAccountNumber: initialBankAccount, createdById, access } = orderData
  const router = useRouter()
  const [bankAccountNumber, setBankAccountNumber] = useState(initialBankAccount ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [isReopening, setIsReopening] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  // Track latest updatedAt from auto-saves to avoid optimistic lock conflicts
  const latestUpdatedAt = useRef(updatedAt)

  // Find the creator's person entry to skip QR on their card
  const creatorPersonId = orderData.session.people.find(p => p.userId === createdById)?.id ?? null

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
    onUpdatedAt: (val) => { latestUpdatedAt.current = val },
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
    setIsClosing(true)
    try {
      await closeOrder(orderId)
      toast.success('Order closed')
      await onStatusChange()
    } catch {
      toast.error('Failed to close order')
    } finally {
      setIsClosing(false)
    }
  }

  const handleReopen = async () => {
    setIsReopening(true)
    try {
      await reopenOrder(orderId)
      toast.success('Order reopened')
      await onStatusChange()
    } catch {
      toast.error('Failed to reopen order')
    } finally {
      setIsReopening(false)
    }
  }

  const handleJoin = async () => {
    setIsJoining(true)
    try {
      await joinOrder(orderId)
      toast.success('Joined order!')
      await onJoined()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to join order')
    } finally {
      setIsJoining(false)
    }
  }

  const handleLeave = async () => {
    const person = session.people.find(p => p.id === access.currentUserPersonId)
    const itemCount = person?.items.length ?? 0

    if (itemCount > 0) {
      if (!confirm(`You have ${itemCount} item${itemCount > 1 ? 's' : ''}. Leaving will remove them. Are you sure?`)) {
        return
      }
    }

    setIsLeaving(true)
    try {
      await leaveOrder(orderId)
      toast.success('Left order')
      router.push('/orders')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to leave order')
    } finally {
      setIsLeaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this order?')) return
    setIsDeleting(true)
    try {
      await deleteOrder(orderId)
      toast.success('Order deleted')
      router.push('/orders')
    } catch {
      toast.error('Failed to delete order')
    } finally {
      setIsDeleting(false)
    }
  }

  const wasEditedAfterCreation = wasEdited(createdAt, updatedAt)
  const isClosed = status === 'CLOSED'

  const showCreatorEditButton = access.canEdit && !isEditing
  const showJoinButton = access.canJoin
  const showLeaveButton = access.canLeave && !isEditingMyItems
  const showCloseButton = access.canClose && !isEditing
  const showReopenButton = access.canReopen && isClosed
  const showDeleteButton = access.canDelete
  const showEditMyItemsForPersonId = (access.canEditMyItems && !isEditingMyItems)
    ? access.currentUserPersonId
    : null

  return (
    <div>
      <Header>
        <div>
          <SectionTitle style={{ marginBottom: 0 }}>
            {restaurantName}
            <StatusBadge $status={status} style={{ marginLeft: '8px' }}>{status === 'OPEN' ? 'Open' : 'Closed'}</StatusBadge>
            {access.isAdminView && (
              <AdminBadge style={{ marginLeft: '8px' }}>Admin view</AdminBadge>
            )}
          </SectionTitle>
          {!access.isCreator && (
            <LastEdited>Created by {creatorName}</LastEdited>
          )}
          {wasEditedAfterCreation && (
            <LastEdited>Last edited: {new Date(updatedAt).toLocaleDateString()}</LastEdited>
          )}
        </div>
        <HeaderActions>
          {showCloseButton && (
            <Button variant="secondary" loading={isClosing} onClick={handleClose}>Close Order</Button>
          )}
          {showReopenButton && (
            <Button variant="secondary" loading={isReopening} onClick={handleReopen}>Reopen Order</Button>
          )}
          {showCreatorEditButton && (
            <Button variant="primary" onClick={onEdit}>Edit order details</Button>
          )}
          {showJoinButton && (
            <Button variant="primary" loading={isJoining} onClick={handleJoin}>Join This Order</Button>
          )}
          {showLeaveButton && (
            <Button variant="danger" loading={isLeaving} onClick={handleLeave}>Leave Order</Button>
          )}
          {showDeleteButton && (
            <Button variant="danger" loading={isDeleting} onClick={handleDelete}>Delete Order</Button>
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
        bankAccountNumber={bankAccountNumber}
        onBankAccountChange={setBankAccountNumber}
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
        editablePersonId={isEditingMyItems ? access.currentUserPersonId : null}
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
        bankAccountNumber={bankAccountNumber || null}
        creatorPersonId={creatorPersonId}
        currentUserPersonId={access.currentUserPersonId}
        orderStatus={status}
        orderId={orderId}
        restaurantName={restaurantName}
        isCreator={access.isCreator || access.isAdminView}
      />

      <Summary summaries={summaries} grandTotal={grandTotal} />

      {(isEditing || isEditingMyItems) && (
        <SaveBar>
          <Button variant="primary" loading={isSaving} onClick={async () => {
            setIsSaving(true)
            try {
              await autoSave.flushAll()
              if (isEditing) {
                await saveOrder(orderId, session, latestUpdatedAt.current, bankAccountNumber || null)
              }
              await onSaved()
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Failed to save order settings')
            } finally {
              setIsSaving(false)
            }
          }}>
            Done
          </Button>
        </SaveBar>
      )}
    </div>
  )
}
