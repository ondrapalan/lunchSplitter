'use client'

import { useEffect, useState, use } from 'react'
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

export default function EditOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params)
  const router = useRouter()
  const [loaded, setLoaded] = useState(false)
  const [loadedSession, setLoadedSession] = useState<LunchSession | null>(null)
  const [restaurantName, setRestaurantName] = useState('')
  const [saving, setSaving] = useState(false)
  const [registeredUsers, setRegisteredUsers] = useState<UserSuggestion[]>([])

  useEffect(() => {
    async function load() {
      const [result, users] = await Promise.all([getOrder(orderId), getRegisteredUsers()])
      setRegisteredUsers(users)
      if (!result) {
        toast.error('Order not found')
        router.push('/orders')
        return
      }
      setRestaurantName(result.restaurantName)
      setLoadedSession(result.session)
      setLoaded(true)
    }
    load()
  }, [orderId, router])

  if (!loaded || !loadedSession) {
    return <SectionTitle>Loading order...</SectionTitle>
  }

  return (
    <EditOrderContent
      orderId={orderId}
      restaurantName={restaurantName}
      initialSession={loadedSession}
      registeredUsers={registeredUsers}
      saving={saving}
      setSaving={setSaving}
    />
  )
}

function EditOrderContent({
  orderId,
  restaurantName,
  initialSession,
  registeredUsers,
  saving,
  setSaving,
}: {
  orderId: string
  restaurantName: string
  initialSession: LunchSession
  registeredUsers: UserSuggestion[]
  saving: boolean
  setSaving: (v: boolean) => void
}) {
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
    } catch {
      toast.error('Failed to save order')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <Header>
        <SectionTitle style={{ marginBottom: 0 }}>{restaurantName}</SectionTitle>
        <SaveStatus>{saving ? 'Saving...' : ''}</SaveStatus>
      </Header>

      <OrderSettings
        globalDiscountPercent={session.globalDiscountPercent}
        feeAdjustments={session.feeAdjustments}
        netFees={netFees}
        feePerPerson={feePerPerson}
        peopleCount={session.people.length}
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
        onAddPerson={addPerson}
        onRemovePerson={removePerson}
        onUpdatePersonName={updatePersonName}
        onAddItem={addItem}
        onUpdateItem={updateItem}
        onRemoveItem={removeItem}
      />

      <Summary summaries={summaries} grandTotal={grandTotal} />

      <CopySummary session={session} summaries={summaries} />

      <SaveBar>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </SaveBar>
    </div>
  )
}
