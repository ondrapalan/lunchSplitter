'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import styled from 'styled-components'
import { toast } from 'react-toastify'

import { RestaurantSuggest } from '~/features/lunch/components/RestaurantSuggest'
import { Input } from '~/features/ui/components/Input'
import { Button } from '~/features/ui/components/Button'
import { SectionTitle } from '~/features/ui/components/SectionTitle'
import { useCreateOrder, useRestaurantNames } from '~/lib/queries/orders'
import { useBankAccount } from '~/lib/queries/account'
import { createOrderSchema, type CreateOrderInput } from '~/lib/validations'

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`

const ErrorText = styled.p`
  color: ${({ theme }) => theme.colors.negative};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  margin: -${({ theme }) => theme.spacing.xs} 0 0;
`

export default function NewOrderPage() {
  const router = useRouter()
  const restaurantsQuery = useRestaurantNames()
  const bankAccountQuery = useBankAccount()
  const createMutation = useCreateOrder()

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrderInput>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: { restaurantName: '', bankAccountNumber: '' },
  })

  // Pre-fill bank account once it loads, but don't override what the user typed.
  useEffect(() => {
    if (bankAccountQuery.data) {
      setValue('bankAccountNumber', bankAccountQuery.data, { shouldDirty: false })
    }
  }, [bankAccountQuery.data, setValue])

  const onSubmit = async (data: CreateOrderInput) => {
    try {
      const order = await createMutation.mutateAsync({
        restaurantName: data.restaurantName.trim(),
        bankAccountNumber: data.bankAccountNumber?.trim() || undefined,
      })
      toast.success('Order opened!')
      router.push(`/orders/${order.id}`)
    } catch {
      toast.error('Failed to create order')
    }
  }

  return (
    <div>
      <Header>
        <SectionTitle style={{ marginBottom: 0 }}>New Order</SectionTitle>
      </Header>

      <Form onSubmit={handleSubmit(onSubmit)}>
        <div>
          <Controller
            name="restaurantName"
            control={control}
            render={({ field }) => (
              <RestaurantSuggest
                value={field.value}
                onChange={field.onChange}
                onSelect={field.onChange}
                suggestions={restaurantsQuery.data ?? []}
                placeholder="Restaurant name"
              />
            )}
          />
          {errors.restaurantName && <ErrorText>{errors.restaurantName.message}</ErrorText>}
        </div>
        <Input {...register('bankAccountNumber')} placeholder="Bank account (e.g. 123456789/0800)" />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Opening...' : 'Open Order'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.push('/orders/new/sekacka')}>
            🥩 New Sekačka
          </Button>
        </div>
      </Form>
    </div>
  )
}
