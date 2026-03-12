'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import styled from 'styled-components'
import { toast } from 'react-toastify'
import { useLunchSession } from '~/features/lunch/hooks/useLunchSession'
import { useCalculation } from '~/features/lunch/hooks/useCalculation'
import { OrderSettings } from '~/features/lunch/components/OrderSettings'
import { PeopleSection } from '~/features/lunch/components/PeopleSection'
import { Summary } from '~/features/lunch/components/Summary'

import { RestaurantSuggest } from '~/features/lunch/components/RestaurantSuggest'
import { Button } from '~/features/ui/components/Button'
import { SectionTitle } from '~/features/ui/components/SectionTitle'
import { createOrder, saveOrder, getRestaurantNames } from '~/actions/orders'
import { getRegisteredUsers } from '~/actions/users'
import type { UserSuggestion } from '~/features/lunch/components/PersonSuggest'

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
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

export default function NewOrderPage() {
  const router = useRouter()
  const [restaurantName, setRestaurantName] = useState('')
  const [saving, setSaving] = useState(false)
  const [registeredUsers, setRegisteredUsers] = useState<UserSuggestion[]>([])
  const [restaurantSuggestions, setRestaurantSuggestions] = useState<string[]>([])

  useEffect(() => {
    getRegisteredUsers().then(setRegisteredUsers)
    getRestaurantNames().then(setRestaurantSuggestions)
  }, [])

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
  } = useLunchSession()

  const { summaries, netFees, feePerPerson, grandTotal } = useCalculation(session)

  const handleSave = async () => {
    if (!restaurantName.trim()) {
      toast.error('Please enter a restaurant name')
      return
    }
    setSaving(true)
    try {
      const order = await createOrder(restaurantName.trim())
      await saveOrder(order.id, session)
      toast.success('Order saved!')
      router.push(`/orders/${order.id}`)
    } catch {
      toast.error('Failed to save order')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <Header>
        <SectionTitle style={{ marginBottom: 0 }}>New Order</SectionTitle>
      </Header>

      <div style={{ marginBottom: '16px' }}>
        <RestaurantSuggest
          value={restaurantName}
          onChange={setRestaurantName}
          suggestions={restaurantSuggestions}
          placeholder="Restaurant name"
        />
      </div>

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

      <SaveBar>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Order'}
        </Button>
      </SaveBar>
    </div>
  )
}
