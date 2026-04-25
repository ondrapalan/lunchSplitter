'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import styled from 'styled-components'
import { toast } from 'react-toastify'

import { Input } from '~/features/ui/components/Input'
import { Button } from '~/features/ui/components/Button'
import { SectionTitle } from '~/features/ui/components/SectionTitle'
import { Card, CardTitle } from '~/features/ui/components/Card'
import { useBankAccount } from '~/lib/queries/account'
import { createSekackaOrder } from '~/actions/sekacka'

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`

const ItemsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`

const ItemRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 110px auto;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: center;
`

const Remove = styled.button`
  background: none;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  color: ${({ theme }) => theme.colors.textMuted};
  cursor: pointer;
  padding: 0 10px;
  height: 36px;
  font-size: ${({ theme }) => theme.fontSizes.md};

  &:hover {
    color: ${({ theme }) => theme.colors.negative};
    border-color: ${({ theme }) => theme.colors.negative};
  }
`

const Hint = styled.p`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  margin: 0;
`

const TotalRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: ${({ theme }) => theme.spacing.sm};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  font-size: ${({ theme }) => theme.fontSizes.md};
`

const ErrorText = styled.p`
  color: ${({ theme }) => theme.colors.negative};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  margin: 0;
`

// Form-side schema: lenient on individual rows so the user can keep blank
// template rows around. We still require *at least one* row that parses to a
// positive number so submit isn't a no-op. Strict per-row validation happens
// on the server inside createSekackaOrder.
const sekackaFormSchema = z
  .object({
    items: z.array(z.object({ name: z.string(), price: z.string() })),
    bankAccountNumber: z.string(),
  })
  .superRefine((data, ctx) => {
    const cleaned = data.items.filter(
      it => it.name.trim().length > 0 && Number.isFinite(Number.parseFloat(it.price)) && Number.parseFloat(it.price) > 0,
    )
    if (cleaned.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Add at least one item with a positive price',
        path: ['items'],
      })
    }
  })

type SekackaFormValues = z.infer<typeof sekackaFormSchema>

const DEFAULT_ITEMS: SekackaFormValues['items'] = [
  { name: 'Sekaná', price: '' },
  { name: 'Rohlíky', price: '' },
  { name: 'Hořčice', price: '' },
]

export default function NewSekackaPage() {
  const router = useRouter()
  const bankAccountQuery = useBankAccount()

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SekackaFormValues>({
    resolver: zodResolver(sekackaFormSchema),
    defaultValues: { items: DEFAULT_ITEMS, bankAccountNumber: '' },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchedItems = watch('items')

  useEffect(() => {
    if (bankAccountQuery.data) {
      setValue('bankAccountNumber', bankAccountQuery.data, { shouldDirty: false })
    }
  }, [bankAccountQuery.data, setValue])

  const total = watchedItems.reduce((sum, it) => {
    const p = Number.parseFloat(it.price)
    return Number.isFinite(p) ? sum + p : sum
  }, 0)

  const onSubmit = async (data: SekackaFormValues) => {
    const cleanItems = data.items
      .map(it => ({ name: it.name.trim(), price: Number.parseFloat(it.price) }))
      .filter(it => it.name.length > 0 && Number.isFinite(it.price) && it.price > 0)

    try {
      const order = await createSekackaOrder({
        items: cleanItems,
        bankAccountNumber: data.bankAccountNumber.trim() || undefined,
      })
      toast.success('Sekačka created!')
      router.push(`/orders/${order.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create Sekačka')
    }
  }

  return (
    <div>
      <SectionTitle>🥩 New Sekačka</SectionTitle>
      <Hint>
        Add what you bought and the price (total, not per piece). After saving, publish
        the message to #obědy and colleagues will click 🍞 Popiči.
      </Hint>

      <Card style={{ marginTop: 16 }}>
        <CardTitle>Items</CardTitle>
        <Form onSubmit={handleSubmit(onSubmit)}>
          <ItemsList>
            {fields.map((field, i) => (
              <ItemRow key={field.id}>
                <Input
                  {...register(`items.${i}.name`)}
                  placeholder="Item (e.g. Sekaná)"
                />
                <Input
                  type="number"
                  inputMode="decimal"
                  step="1"
                  min="0"
                  {...register(`items.${i}.price`)}
                  placeholder="Kč"
                />
                <Remove type="button" onClick={() => remove(i)} title="Remove item">×</Remove>
              </ItemRow>
            ))}
          </ItemsList>
          {errors.items && (
            <ErrorText>
              {errors.items.message ?? errors.items.root?.message ?? 'Add at least one item'}
            </ErrorText>
          )}

          <Button type="button" variant="secondary" onClick={() => append({ name: '', price: '' })}>
            + Add item
          </Button>

          <TotalRow>
            <span>Total</span>
            <strong>{total.toFixed(2)} Kč</strong>
          </TotalRow>

          <Input
            {...register('bankAccountNumber')}
            placeholder="Bank account (e.g. 123456789/0800)"
          />

          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Create Sekačka'}
          </Button>
        </Form>
      </Card>
    </div>
  )
}
