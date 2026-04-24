'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import styled from 'styled-components'
import { toast } from 'react-toastify'

import { Input } from '~/features/ui/components/Input'
import { Button } from '~/features/ui/components/Button'
import { SectionTitle } from '~/features/ui/components/SectionTitle'
import { Card, CardTitle } from '~/features/ui/components/Card'
import { getBankAccount } from '~/actions/auth'
import { createSekackaOrder } from '~/actions/sekacka'

const Form = styled.div`
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

interface DraftItem {
  name: string
  price: string
}

const DEFAULT_ITEMS: DraftItem[] = [
  { name: 'Sekaná', price: '' },
  { name: 'Rohlíky', price: '' },
  { name: 'Hořčice', price: '' },
]

export default function NewSekackaPage() {
  const router = useRouter()
  const [items, setItems] = useState<DraftItem[]>(DEFAULT_ITEMS)
  const [bankAccount, setBankAccount] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    getBankAccount().then(v => { if (v) setBankAccount(v) })
  }, [])

  const updateItem = (idx: number, patch: Partial<DraftItem>) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }
  const addItem = () => setItems(prev => [...prev, { name: '', price: '' }])
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))

  const total = items.reduce((sum, it) => {
    const p = Number.parseFloat(it.price)
    return Number.isFinite(p) ? sum + p : sum
  }, 0)

  const handleCreate = async () => {
    const cleanItems = items
      .map(it => ({ name: it.name.trim(), price: Number.parseFloat(it.price) }))
      .filter(it => it.name.length > 0 && Number.isFinite(it.price) && it.price > 0)

    if (cleanItems.length === 0) {
      toast.error('Add at least one item with a positive price')
      return
    }

    setCreating(true)
    try {
      const order = await createSekackaOrder({
        items: cleanItems,
        bankAccountNumber: bankAccount.trim() || undefined,
      })
      toast.success('Sekačka created!')
      router.push(`/orders/${order.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create Sekačka')
    } finally {
      setCreating(false)
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
        <Form>
          <ItemsList>
            {items.map((item, i) => (
              <ItemRow key={i}>
                <Input
                  value={item.name}
                  onChange={e => updateItem(i, { name: e.target.value })}
                  placeholder="Item (e.g. Sekaná)"
                />
                <Input
                  type="number"
                  inputMode="decimal"
                  step="1"
                  min="0"
                  value={item.price}
                  onChange={e => updateItem(i, { price: e.target.value })}
                  placeholder="Kč"
                />
                <Remove type="button" onClick={() => removeItem(i)} title="Remove item">×</Remove>
              </ItemRow>
            ))}
          </ItemsList>

          <Button variant="secondary" onClick={addItem}>+ Add item</Button>

          <TotalRow>
            <span>Total</span>
            <strong>{total.toFixed(2)} Kč</strong>
          </TotalRow>

          <Input
            value={bankAccount}
            onChange={e => setBankAccount(e.target.value)}
            placeholder="Bank account (e.g. 123456789/0800)"
          />

          <Button variant="primary" onClick={handleCreate} disabled={creating}>
            {creating ? 'Saving…' : 'Create Sekačka'}
          </Button>
        </Form>
      </Card>
    </div>
  )
}
