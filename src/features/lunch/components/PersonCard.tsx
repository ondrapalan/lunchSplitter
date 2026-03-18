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
import { QrPlatba } from './QrPlatba'
import type { Item, Person, PersonSummary } from '../types'
import { formatCurrency } from '../utils/formatters'
import { buildSpdString, czechAccountToIban, generateVariableSymbol } from '../utils/qrPlatba'

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

const CardContentRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
`

const CardMainContent = styled.div`
  flex: 1;
  min-width: 0;
`

interface PersonCardProps {
  person: Person
  allPeople: Person[]
  summary: PersonSummary | undefined
  globalDiscountPercent: number
  itemSuggestions: ItemSuggestion[]
  canEditItems?: boolean
  canEditName?: boolean
  canRemove?: boolean
  hideShareControls?: boolean
  showEditMyItemsButton?: boolean
  onEditMyItems?: () => void
  onRemovePerson: () => void
  onUpdateName: (name: string) => void
  onAddItem: (name: string, price: number) => void
  onUpdateItem: (itemId: string, updates: Partial<Omit<Item, 'id'>>) => void
  onRemoveItem: (itemId: string) => void
  onFlushItem?: (itemId: string) => void
  // QR Platba props
  bankAccountNumber?: string | null
  creatorPersonId?: string | null
  orderStatus?: 'OPEN' | 'CLOSED'
  orderId?: string
  restaurantName?: string
  showCopyQr?: boolean
}

export function PersonCard({
  person,
  allPeople,
  summary,
  globalDiscountPercent,
  itemSuggestions,
  canEditItems = false,
  canEditName = false,
  canRemove = false,
  hideShareControls = false,
  showEditMyItemsButton = false,
  onEditMyItems,
  onRemovePerson,
  onUpdateName,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onFlushItem,
  bankAccountNumber,
  creatorPersonId,
  orderStatus,
  orderId,
  restaurantName,
  showCopyQr,
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

  // QR Platba: show when order is closed, bank account is set, not creator, amount > 0
  const showQr = orderStatus === 'CLOSED'
    && !!bankAccountNumber
    && person.id !== creatorPersonId
    && !!summary
    && summary.withFees > 0
    && !!orderId

  let spdString: string | null = null
  if (showQr && bankAccountNumber && orderId) {
    try {
      const iban = czechAccountToIban(bankAccountNumber)
      const variableSymbol = generateVariableSymbol(orderId, person.id)
      spdString = buildSpdString({
        iban,
        amount: summary!.withFees,
        variableSymbol,
        message: restaurantName ?? '',
      })
    } catch {
      // Invalid bank account format — skip QR
    }
  }

  return (
    <Card>
      <CardHeader>
        {editingName && canEditName ? (
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
          <CardTitle
            onClick={canEditName ? () => setEditingName(true) : undefined}
            style={canEditName ? { cursor: 'pointer' } : undefined}
          >
            {person.name}
            {person.userId && <RegisteredBadge> (user)</RegisteredBadge>}
          </CardTitle>
        )}
        {showEditMyItemsButton && onEditMyItems && (
          <Button variant="primary" size="sm" onClick={onEditMyItems}>
            Edit My Items
          </Button>
        )}
        {canRemove && (
          <Button variant="danger" size="sm" onClick={onRemovePerson}>X</Button>
        )}
      </CardHeader>

      <CardContentRow>
        <CardMainContent>
          {person.items.map(item => (
            <ItemRow
              key={item.id}
              item={item}
              globalDiscountPercent={globalDiscountPercent}
              allPeople={allPeople}
              ownerId={person.id}
              editable={canEditItems}
              hideShareControls={hideShareControls}
              onUpdate={updates => onUpdateItem(item.id, updates)}
              onRemove={() => onRemoveItem(item.id)}
              onBlurSave={onFlushItem ? () => onFlushItem(item.id) : undefined}
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

          {canEditItems && (
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
              <Button variant="primary" size="sm" onClick={handleAddItem}>
                + Add
              </Button>
            </AddItemRow>
          )}

          {summary && (
            <PersonSubtotals>
              <SubtotalItem>Subtotal: {formatCurrency(summary.subtotal)}</SubtotalItem>
              <SubtotalItem>After discount: {formatCurrency(summary.afterDiscount)}</SubtotalItem>
              <SubtotalItem $highlight>With fees: {formatCurrency(summary.withFees)}</SubtotalItem>
            </PersonSubtotals>
          )}
        </CardMainContent>

        {spdString && (
          <QrPlatba
            spdString={spdString}
            amount={summary!.withFees}
            showCopyButton={showCopyQr}
          />
        )}
      </CardContentRow>
    </Card>
  )
}
