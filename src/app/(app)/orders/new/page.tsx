'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import styled from 'styled-components'
import { toast } from 'react-toastify'

import { RestaurantSuggest } from '~/features/lunch/components/RestaurantSuggest'
import { Input } from '~/features/ui/components/Input'
import { Button } from '~/features/ui/components/Button'
import { SectionTitle } from '~/features/ui/components/SectionTitle'
import { createOrder, getRestaurantNames } from '~/actions/orders'
import { getBankAccount } from '~/actions/auth'

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`

const Form = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`

export default function NewOrderPage() {
  const router = useRouter()
  const [restaurantName, setRestaurantName] = useState('')
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [creating, setCreating] = useState(false)
  const [restaurantSuggestions, setRestaurantSuggestions] = useState<string[]>([])

  useEffect(() => {
    getRestaurantNames().then(setRestaurantSuggestions)
    getBankAccount().then(value => {
      if (value) setBankAccountNumber(value)
    })
  }, [])

  const handleOpen = async () => {
    if (!restaurantName.trim()) {
      toast.error('Please enter a restaurant name')
      return
    }
    setCreating(true)
    try {
      const order = await createOrder(restaurantName.trim(), bankAccountNumber.trim() || undefined)
      toast.success('Order opened!')
      router.push(`/orders/${order.id}`)
    } catch {
      toast.error('Failed to create order')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      <Header>
        <SectionTitle style={{ marginBottom: 0 }}>New Order</SectionTitle>
      </Header>

      <Form>
        <RestaurantSuggest
          value={restaurantName}
          onChange={setRestaurantName}
          onSelect={setRestaurantName}
          suggestions={restaurantSuggestions}
          placeholder="Restaurant name"
        />
        <Input
          value={bankAccountNumber}
          onChange={e => setBankAccountNumber(e.target.value)}
          placeholder="Bank account (e.g. 123456789/0800)"
        />
        <div>
          <Button variant="primary" onClick={handleOpen} disabled={creating}>
            {creating ? 'Opening...' : 'Open Order'}
          </Button>
        </div>
      </Form>
    </div>
  )
}
