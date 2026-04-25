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
import { useGuardDirty } from '~/features/lunch/components/NavigationGuard'

import { Button } from '~/features/ui/components/Button'
import { SectionTitle } from '~/features/ui/components/SectionTitle'
import { SkeletonCard, SkeletonTitle } from '~/features/ui/components/Skeleton'
import { StatusBadge } from '~/features/ui/components/StatusBadge'
import { AdminBadge } from '~/features/ui/components/AdminBadge'
import {
  DialogActions,
  DialogBackdrop,
  DialogBody,
  DialogPanel,
  DialogTitle,
} from '~/features/ui/components/Dialog'
import {
  useCloseOrderWithDraft,
  useDeleteOrder,
  useItemsByRestaurant,
  useJoinOrder,
  useLeaveOrder,
  useOrder,
  useReopenOrder,
} from '~/lib/queries/orders'
import { useRegisteredUsers } from '~/lib/queries/users'
import { useGuests } from '~/lib/queries/guests'
import type { GuestSuggestion } from '~/actions/guests'
import type { UserSuggestion } from '~/features/lunch/components/PersonSuggest'
import { getPaymentConfirmations, togglePaymentConfirmation } from '~/actions/discord'
import { SekackaOrderDetail } from '~/features/lunch/components/SekackaOrderDetail'
import { wasEdited } from '~/features/lunch/utils/formatters'
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
  type: 'NORMAL' | 'SEKACKA'
  discordAnnounceMessageId: string | null
  bankAccountNumber: string | null
  creatorBankAccount: string | null
  createdById: string
  access: OrderAccess
}

export default function OrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params)
  const router = useRouter()
  const [isEditingMyItems, setIsEditingMyItems] = useState(false)
  const [contentKey, setContentKey] = useState(0)

  const orderQuery = useOrder(orderId)
  const usersQuery = useRegisteredUsers()
  const guestsQuery = useGuests()
  const orderData = orderQuery.data as OrderData | null | undefined
  const itemsQuery = useItemsByRestaurant(orderData?.restaurantName)

  const registeredUsers = usersQuery.data ?? []
  const guestSuggestions = guestsQuery.data ?? []
  const historicalItems: ItemSuggestion[] = itemsQuery.data ?? []

  const load = useCallback(async () => {
    await Promise.all([orderQuery.refetch(), usersQuery.refetch(), guestsQuery.refetch()])
  }, [orderQuery, usersQuery, guestsQuery])

  const notFound = orderQuery.isSuccess && orderData === null
  useEffect(() => {
    if (notFound) {
      toast.error('Order not found')
      router.push('/orders')
    }
  }, [notFound, router])

  useEffect(() => {
    if (orderQuery.error) toast.error('Failed to load order')
  }, [orderQuery.error])

  if (!orderData) {
    return (
      <div>
        <SkeletonTitle />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
      </div>
    )
  }

  if (orderData.type === 'SEKACKA') {
    return (
      <SekackaOrderDetail
        orderId={orderId}
        creatorName={orderData.creatorName}
        session={orderData.session}
        status={orderData.status}
        createdById={orderData.createdById}
        discordAnnounceMessageId={orderData.discordAnnounceMessageId}
        access={{
          isCreator: orderData.access.isCreator,
          isAdminView: orderData.access.isAdminView,
          canEdit: orderData.access.canEdit,
          canClose: orderData.access.canClose,
          canReopen: orderData.access.canReopen,
          canDelete: orderData.access.canDelete,
        }}
        onReload={() => {
          load()
          setContentKey(k => k + 1)
        }}
      />
    )
  }

  return (
    <OrderContent
      key={contentKey}
      orderId={orderId}
      orderData={orderData}
      registeredUsers={registeredUsers}
      guestSuggestions={guestSuggestions}
      historicalItemSuggestions={historicalItems}
      isEditingMyItems={isEditingMyItems}
      onEditMyItems={() => setIsEditingMyItems(true)}
      onStatusChange={async () => {
        setIsEditingMyItems(false)
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
  isEditingMyItems,
  onEditMyItems,
  onStatusChange,
  onJoined,
}: {
  orderId: string
  orderData: OrderData
  registeredUsers: UserSuggestion[]
  guestSuggestions: GuestSuggestion[]
  historicalItemSuggestions: ItemSuggestion[]
  isEditingMyItems: boolean
  onEditMyItems: () => void
  onStatusChange: () => Promise<void>
  onJoined: () => Promise<void>
}) {
  const { restaurantName, session: initialSession, createdAt, updatedAt, creatorName, status, bankAccountNumber: initialBankAccount, createdById, access } = orderData
  const router = useRouter()
  const [bankAccountNumber, setBankAccountNumber] = useState(initialBankAccount ?? '')
  const [isClosing, setIsClosing] = useState(false)
  const [isReopening, setIsReopening] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [paymentConfirmations, setPaymentConfirmations] = useState<Record<string, { confirmed: boolean; confirmedAt: string | null }>>({})

  // Status drives editability. The creator gets in-place editing on every
  // OPEN order; closed orders render read-only with a Reopen button.
  const isCreatorEditing = status === 'OPEN' && access.isCreator

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
    isDirty: sessionDirty,
    markClean,
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
    enabled: status === 'OPEN' && (access.isCreator || isEditingMyItems),
    onUpdatedAt: (val) => { latestUpdatedAt.current = val },
  })

  // Push the combined dirty signal into NavigationGuardProvider so the layout
  // nav, browser back, and tab close all prompt before discarding the draft.
  const bankDirty = (bankAccountNumber || '') !== (initialBankAccount ?? '')
  const totalDirty = sessionDirty || bankDirty || autoSave.hasPendingItemSaves
  useGuardDirty(`order:${orderId}`, totalDirty)

  const handleAutoSaveAddItem = useCallback((personId: string, name: string, price: number, options?: { isPackaging?: boolean }) => {
    const itemId = crypto.randomUUID()
    addItem(personId, name, price, itemId, options)
    autoSave.saveAddItem(personId, { id: itemId, name, price, discountPercent: null, isPackaging: options?.isPackaging ?? false })
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

  const closeMutation = useCloseOrderWithDraft()
  const reopenMutation = useReopenOrder()
  const joinMutation = useJoinOrder()
  const leaveMutation = useLeaveOrder()
  const deleteMutation = useDeleteOrder()

  const handleClose = async (sendDiscord: boolean) => {
    setCloseDialogOpen(false)
    setIsClosing(true)
    try {
      // Flush any debounced item saves so they land before we commit + lock.
      await autoSave.flushAll()
      const result = await closeMutation.mutateAsync([
        orderId,
        {
          globalDiscountPercent: session.globalDiscountPercent,
          feeAdjustments: session.feeAdjustments.map(f => ({ id: f.id, name: f.name, amount: f.amount })),
          bankAccountNumber: bankAccountNumber || null,
        },
        { sendDiscord, expectedUpdatedAt: latestUpdatedAt.current },
      ])
      // Clear dirty so NavigationGuard doesn't prompt on the post-close refetch.
      markClean(session)
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to close order')
    } finally {
      setIsClosing(false)
    }
  }

  const handleReopen = async () => {
    setIsReopening(true)
    try {
      await reopenMutation.mutateAsync(orderId)
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
      await joinMutation.mutateAsync(orderId)
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
      await leaveMutation.mutateAsync(orderId)
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
      await deleteMutation.mutateAsync(orderId)
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

  const showJoinButton = access.canJoin
  const showLeaveButton = access.canLeave && !isEditingMyItems
  const showCloseButton = access.canClose
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
            <Button variant="primary" loading={isClosing} onClick={() => setCloseDialogOpen(true)}>Close Order</Button>
          )}
          {showReopenButton && (
            <Button variant="secondary" loading={isReopening} onClick={handleReopen}>Reopen Order</Button>
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
          {status === 'OPEN' && autoSave.saveStatus !== 'idle' && (
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
        editable={isCreatorEditing}
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
        canAddPerson={isCreatorEditing}
        canEditItems={isCreatorEditing}
        canEditNames={isCreatorEditing}
        canRemovePeople={isCreatorEditing}
        hideShareControls={isEditingMyItems}
        editablePersonId={isEditingMyItems ? access.currentUserPersonId : null}
        showEditMyItemsForPersonId={showEditMyItemsForPersonId}
        onEditMyItems={onEditMyItems}
        onAddPerson={isCreatorEditing ? handleAutoSaveAddPerson : addPerson}
        onAddGuest={isCreatorEditing ? handleAutoSaveAddGuest : undefined}
        onUpdatePersonHost={isCreatorEditing ? handleAutoSaveUpdatePersonHost : updatePersonHost}
        onRemovePerson={isCreatorEditing ? handleAutoSaveRemovePerson : removePerson}
        onUpdatePersonName={isCreatorEditing ? handleAutoSaveUpdatePersonName : updatePersonName}
        onAddItem={isCreatorEditing || isEditingMyItems
          ? handleAutoSaveAddItem
          : (personId, name, price, options) => addItem(personId, name, price, undefined, options)
        }
        onUpdateItem={isCreatorEditing || isEditingMyItems ? handleAutoSaveUpdateItem : updateItem}
        onRemoveItem={isCreatorEditing || isEditingMyItems ? handleAutoSaveRemoveItem : removeItem}
        onFlushItem={(isCreatorEditing || isEditingMyItems)
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
        createdById={createdById}
        paymentConfirmations={paymentConfirmations}
        onTogglePayment={(access.isCreator || access.isAdminView) ? handleTogglePayment : undefined}
      />

      <Summary summaries={summaries} grandTotal={grandTotal} />

      {closeDialogOpen && (
        <DialogBackdrop onClick={() => !isClosing && setCloseDialogOpen(false)}>
          <DialogPanel onClick={e => e.stopPropagation()}>
            <DialogTitle>Close this order?</DialogTitle>
            <DialogBody>
              Closing the order locks it from further edits and commits any
              fee, discount, or bank-account changes. You can also send each
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
