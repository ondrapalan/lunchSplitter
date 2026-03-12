'use client'

import { useState } from 'react'
import styled from 'styled-components'
import { Card, CardHeader, CardTitle } from '~/features/ui/components/Card'
import { Input, NumberInput } from '~/features/ui/components/Input'
import { Button } from '~/features/ui/components/Button'
import { ItemRow } from './ItemRow'
import { SharedItemRef } from './SharedItemRef'
import { ItemSuggest } from './ItemSuggest'
import type { ItemSuggestion } from './ItemSuggest'
import type { Item, Person, PersonSummary } from '../types'
import { formatCurrency } from '../utils/formatters'

const PersonSubtotals = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.sm};
  padding-top: ${({ theme }) => theme.spacing.sm};
  border-top: 1px dashed ${({ theme }) => theme.colors.border};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`

const SubtotalItem = styled.span<{ $highlight?: boolean }>`
  color: ${({ $highlight, theme }) => $highlight ? theme.colors.warning : theme.colors.textDim};
`

const RegisteredBadge = styled.span`
  color: ${({ theme }) => theme.colors.accent};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 400;
`

const AddItemRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.sm};
`

interface PersonCardProps {
  person: Person
  allPeople: Person[]
  summary: PersonSummary | undefined
  globalDiscountPercent: number
  itemSuggestions: ItemSuggestion[]
  onRemovePerson: () => void
  onUpdateName: (name: string) => void
  onAddItem: (name: string, price: number) => void
  onUpdateItem: (itemId: string, updates: Partial<Omit<Item, 'id'>>) => void
  onRemoveItem: (itemId: string) => void
}

export function PersonCard({
  person,
  allPeople,
  summary,
  globalDiscountPercent,
  itemSuggestions,
  onRemovePerson,
  onUpdateName,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
}: PersonCardProps) {
  const [newItemName, setNewItemName] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('')
  const [editingName, setEditingName] = useState(false)

  const handleAddItem = () => {
    const price = parseFloat(newItemPrice)
    if (newItemName.trim() && !isNaN(price) && price > 0) {
      onAddItem(newItemName.trim(), price)
      setNewItemName('')
      setNewItemPrice('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAddItem()
  }

  const handleSuggestionSelect = (suggestion: ItemSuggestion) => {
    setNewItemName(suggestion.name)
    setNewItemPrice(String(suggestion.price))
  }

  // Find items shared from other people to this person
  const sharedFromOthers = allPeople
    .filter(p => p.id !== person.id)
    .flatMap(p =>
      p.items
        .filter(item => item.sharedWith.includes(person.id))
        .map(item => ({ item, owner: p }))
    )

  return (
    <Card>
      <CardHeader>
        {editingName ? (
          <Input
            autoFocus
            defaultValue={person.name}
            onBlur={e => {
              onUpdateName(e.target.value)
              setEditingName(false)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                onUpdateName((e.target as HTMLInputElement).value)
                setEditingName(false)
              }
            }}
            style={{ maxWidth: '200px' }}
          />
        ) : (
          <CardTitle onClick={() => setEditingName(true)} style={{ cursor: 'pointer' }}>
            {person.name}
            {person.userId && <RegisteredBadge> (user)</RegisteredBadge>}
          </CardTitle>
        )}
        <Button variant="danger" size="sm" onClick={onRemovePerson}>X</Button>
      </CardHeader>

      {person.items.map(item => (
        <ItemRow
          key={item.id}
          item={item}
          globalDiscountPercent={globalDiscountPercent}
          allPeople={allPeople}
          ownerId={person.id}
          onUpdate={updates => onUpdateItem(item.id, updates)}
          onRemove={() => onRemoveItem(item.id)}
        />
      ))}

      {sharedFromOthers.map(({ item, owner }) => (
        <SharedItemRef
          key={`shared-${item.id}`}
          item={item}
          owner={owner}
          personId={person.id}
        />
      ))}

      <AddItemRow>
        <ItemSuggest
          value={newItemName}
          onChange={setNewItemName}
          onSelect={handleSuggestionSelect}
          suggestions={itemSuggestions}
          onKeyDown={handleKeyDown}
          placeholder="Item name"
        />
        <NumberInput
          value={newItemPrice}
          onChange={e => setNewItemPrice(e.target.value)}
          placeholder="Price"
          onKeyDown={handleKeyDown}
          min={0}
        />
        <Button variant="secondary" size="sm" onClick={handleAddItem}>
          + Add
        </Button>
      </AddItemRow>

      {summary && (
        <PersonSubtotals>
          <SubtotalItem>Subtotal: {formatCurrency(summary.subtotal)}</SubtotalItem>
          <SubtotalItem>After discount: {formatCurrency(summary.afterDiscount)}</SubtotalItem>
          <SubtotalItem $highlight>With fees: {formatCurrency(summary.withFees)}</SubtotalItem>
        </PersonSubtotals>
      )}
    </Card>
  )
}
