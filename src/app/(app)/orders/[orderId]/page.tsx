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
import { CopySummary } from '~/features/lunch/components/CopySummary'
import { Button } from '~/features/ui/components/Button'
import { SectionTitle } from '~/features/ui/components/SectionTitle'
import { getOrder, saveOrder } from '~/actions/orders'
import { getRegisteredUsers } from '~/actions/users'
import { wasEdited } from '~/features/lunch/utils/formatters'
import type { UserSuggestion } from '~/features/lunch/components/PersonSuggest'
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

export default function EditOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params)
  const router = useRouter()
  const [loaded, setLoaded] = useState(false)
  const [loadedSession, setLoadedSession] = useState<LunchSession | null>(null)
  const [restaurantName, setRestaurantName] = useState('')
  const [registeredUsers, setRegisteredUsers] = useState<UserSuggestion[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [contentKey, setContentKey] = useState(0)
  const [isCreator, setIsCreator] = useState(false)
  const [createdAt, setCreatedAt] = useState('')
  const [updatedAt, setUpdatedAt] = useState('')
  const [creatorName, setCreatorName] = useState('')

  const load = useCallback(async () => {
    const [result, users] = await Promise.all([getOrder(orderId), getRegisteredUsers()])
    setRegisteredUsers(users)
    if (!result) {
      toast.error('Order not found')
      router.push('/orders')
      return
    }
    setRestaurantName(result.restaurantName)
    setLoadedSession(result.session)
    setIsCreator(result.isCreator)
    setCreatedAt(result.createdAt)
    setUpdatedAt(result.updatedAt)
    setCreatorName(result.creatorName)
    setLoaded(true)
    // Auto-enter edit mode for empty orders
    if (result.session.people.length === 0 && result.isCreator) {
      setIsEditing(true)
    }
  }, [orderId, router])

  useEffect(() => {
    load()
  }, [load])

  if (!loaded || !loadedSession) {
    return <SectionTitle>Loading order...</SectionTitle>
  }

  return (
    <EditOrderContent
      key={contentKey}
      orderId={orderId}
      restaurantName={restaurantName}
      initialSession={loadedSession}
      registeredUsers={registeredUsers}
      isCreator={isCreator}
      isEditing={isEditing}
      createdAt={createdAt}
      updatedAt={updatedAt}
      creatorName={creatorName}
      onEdit={() => setIsEditing(true)}
      onCancel={async () => {
        setIsEditing(false)
        await load()
        setContentKey(k => k + 1)
      }}
      onSaved={async () => {
        setIsEditing(false)
        await load()
        setContentKey(k => k + 1)
      }}
    />
  )
}

function EditOrderContent({
  orderId,
  restaurantName,
  initialSession,
  registeredUsers,
  isCreator,
  isEditing,
  createdAt,
  updatedAt,
  // creatorName reserved for future use (e.g. "Created by" label)
  onEdit,
  onCancel,
  onSaved,
}: {
  orderId: string
  restaurantName: string
  initialSession: LunchSession
  registeredUsers: UserSuggestion[]
  isCreator: boolean
  isEditing: boolean
  createdAt: string
  updatedAt: string
  creatorName: string
  onEdit: () => void
  onCancel: () => Promise<void>
  onSaved: () => Promise<void>
}) {
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
      await saveOrder(orderId, session)
      toast.success('Order saved!')
      await onSaved()
    } catch {
      toast.error('Failed to save order')
    } finally {
      setSaving(false)
    }
  }

  const wasEditedAfterCreation = wasEdited(createdAt, updatedAt)

  return (
    <div>
      <Header>
        <div>
          <SectionTitle style={{ marginBottom: 0 }}>{restaurantName}</SectionTitle>
          {wasEditedAfterCreation && (
            <LastEdited>Last edited: {new Date(updatedAt).toLocaleDateString()}</LastEdited>
          )}
        </div>
        {isCreator && !isEditing && (
          <Button variant="primary" onClick={onEdit}>
            Edit order details
          </Button>
        )}
        {isEditing && (
          <SaveStatus>{saving ? 'Saving...' : ''}</SaveStatus>
        )}
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
        editable={isEditing}
        onAddPerson={addPerson}
        onRemovePerson={removePerson}
        onUpdatePersonName={updatePersonName}
        onAddItem={addItem}
        onUpdateItem={updateItem}
        onRemoveItem={removeItem}
      />

      <Summary summaries={summaries} grandTotal={grandTotal} />

      <CopySummary session={session} summaries={summaries} />

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
    </div>
  )
}
