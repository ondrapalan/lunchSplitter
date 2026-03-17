'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import styled from 'styled-components'
import { toast } from 'react-toastify'

import { RestaurantSuggest } from '~/features/lunch/components/RestaurantSuggest'
import { Button } from '~/features/ui/components/Button'
import { SectionTitle } from '~/features/ui/components/SectionTitle'
import { createOrder, getRestaurantNames } from '~/actions/orders'

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
  const [creating, setCreating] = useState(false)
  const [restaurantSuggestions, setRestaurantSuggestions] = useState<string[]>([])

  useEffect(() => {
    getRestaurantNames().then(setRestaurantSuggestions)
  }, [])

  const handleOpen = async () => {
    if (!restaurantName.trim()) {
      toast.error('Please enter a restaurant name')
      return
    }
    setCreating(true)
    try {
      const order = await createOrder(restaurantName.trim())
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
        <div>
          <Button variant="primary" onClick={handleOpen} disabled={creating}>
            {creating ? 'Opening...' : 'Open Order'}
          </Button>
        </div>
      </Form>
    </div>
  )
}
