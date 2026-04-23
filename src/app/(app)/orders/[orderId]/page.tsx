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
import { listGuests } from '~/actions/guests'
import type { GuestSuggestion } from '~/actions/guests'
import { getPaymentConfirmations, togglePaymentConfirmation } from '~/actions/discord'
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

const DialogBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: ${({ theme }) => theme.spacing.md};
`

const DialogPanel = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.lg};
  max-width: 440px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`

const DialogTitle = styled.h3`
  margin: 0;
  color: ${({ theme }) => theme.colors.text};
  font-size: ${({ theme }) => theme.fontSizes.lg};
`

const DialogBody = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  line-height: 1.5;
`

const DialogActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
  justify-content: flex-end;
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
  const [guestSuggestions, setGuestSuggestions] = useState<GuestSuggestion[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [isEditingMyItems, setIsEditingMyItems] = useState(false)
  const [contentKey, setContentKey] = useState(0)
  const [historicalItems, setHistoricalItems] = useState<ItemSuggestion[]>([])

  const load = useCallback(async () => {
    try {
      const [result, users, guests] = await Promise.all([getOrder(orderId), getRegisteredUsers(), listGuests()])
      setRegisteredUsers(users)
      setGuestSuggestions(guests)
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
      guestSuggestions={guestSuggestions}
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
  guestSuggestions,
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
  guestSuggestions: GuestSuggestion[]
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
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [paymentConfirmations, setPaymentConfirmations] = useState<Record<string, { confirmed: boolean; confirmedAt: string | null }>>({})

  // Load payment confirmations for closed orders + poll every 30s
  useEffect(() => {
    if (status !== 'CLOSED') return

    const loadConfirmations = () => {
      getPaymentConfirmations(orderId).then(setPaymentConfirmations).catch(() => {})
    }
    loadConfirmations()

    const interval = setInterval(loadConfirmations, 30_000)
    return () => clearInterval(interval)
  }, [status, orderId])

  const handleTogglePayment = useCallback(async (personId: string) => {
    try {
      const { confirmed } = await togglePaymentConfirmation(personId)
      setPaymentConfirmations(prev => ({
        ...prev,
        [personId]: { confirmed, confirmedAt: confirmed ? new Date().toISOString() : null },
      }))
    } catch {
      toast.error('Failed to update payment status')
    }
  }, [])

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
    addGuest,
    updatePersonHost,
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

  const handleAutoSaveAddGuest = useCallback((options: {
    name: string
    hostUserId: string
    guestId?: string
    newGuest?: { name: string; defaultHostUserId: string }
  }) => {
    const personId = crypto.randomUUID()
    addGuest({ ...options, id: personId })
    autoSave.saveAddGuest(personId, options)
  }, [addGuest, autoSave])

  const handleAutoSaveUpdatePersonHost = useCallback((personId: string, hostUserId: string) => {
    updatePersonHost(personId, hostUserId)
    autoSave.saveUpdatePersonHost(personId, hostUserId)
  }, [updatePersonHost, autoSave])

  const { summaries, netFees, feePerPerson, grandTotal } = useCalculation(session)

  const handleClose = async (sendDiscord: boolean) => {
    setCloseDialogOpen(false)
    setIsClosing(true)
    try {
      const result = await closeOrder(orderId, { sendDiscord })
      toast.success(sendDiscord ? 'Order closed' : 'Order closed (no DMs sent)')
      if (result.discord) {
        const { sent, skipped, failed } = result.discord
        if (sent.length > 0) {
          toast.info(`Discord QR sent to: ${sent.join(', ')}`)
        }
        if (skipped.length > 0) {
          toast.warn(`No Discord linked: ${skipped.join(', ')}`)
        }
        if (failed.length > 0) {
          toast.error(`Discord failed for: ${failed.join(', ')}`)
        }
      }
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
            <Button variant="secondary" loading={isClosing} onClick={() => setCloseDialogOpen(true)}>Close Order</Button>
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
        guestSuggestions={guestSuggestions}
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
        onAddGuest={isEditing ? handleAutoSaveAddGuest : undefined}
        onUpdatePersonHost={isEditing ? handleAutoSaveUpdatePersonHost : updatePersonHost}
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
        paymentConfirmations={paymentConfirmations}
        onTogglePayment={(access.isCreator || access.isAdminView) ? handleTogglePayment : undefined}
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

      {closeDialogOpen && (
        <DialogBackdrop onClick={() => !isClosing && setCloseDialogOpen(false)}>
          <DialogPanel onClick={e => e.stopPropagation()}>
            <DialogTitle>Close this order?</DialogTitle>
            <DialogBody>
              Closing the order locks it from further edits. You can also send each
              participant a Discord DM with their QR code — skip this if you&apos;ve
              already sent them (for example after reopening to edit).
            </DialogBody>
            <DialogActions>
              <Button variant="secondary" onClick={() => setCloseDialogOpen(false)} disabled={isClosing}>
                Cancel
              </Button>
              <Button variant="secondary" loading={isClosing} onClick={() => handleClose(false)}>
                Close silently
              </Button>
              <Button variant="primary" loading={isClosing} onClick={() => handleClose(true)}>
                Close &amp; send QRs
              </Button>
            </DialogActions>
          </DialogPanel>
        </DialogBackdrop>
      )}
    </div>
  )
}
