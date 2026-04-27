'use client'

import { useState } from 'react'
import styled from 'styled-components'
import { media } from '~/features/ui/theme'
import { Card, CardHeader, CardTitle } from '~/features/ui/components/Card'
import { Input, NumberInput } from '~/features/ui/components/Input'
import { Button } from '~/features/ui/components/Button'
import { ItemRow } from './ItemRow'
import { SharedItemRef } from './SharedItemRef'
import { ItemSuggest } from './ItemSuggest'
import type { ItemSuggestion } from './ItemSuggest'
import { QrPlatba } from './QrPlatba'
import { HostPicker, type HostOption } from './HostPicker'
import type { Item, Person, PersonSummary } from '../types'
import { formatCurrency } from '../utils/formatters'
import { buildSpdString, czechAccountToIban, generateVariableSymbol } from '../utils/qrPlatba'

const PersonSubtotals = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.sm};
  padding-top: ${({ theme }) => theme.spacing.sm};
  border-top: 1px dashed ${({ theme }) => theme.colors.border};
  font-size: ${({ theme }) => theme.fontSizes.sm};

  ${media.mobile} {
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
  }
`

const SubtotalItem = styled.span<{ $final?: boolean }>`
  color: ${({ $final, theme }) => $final ? theme.colors.positive : theme.colors.textDim};
  font-weight: ${({ $final }) => $final ? 600 : 400};
  font-size: ${({ $final, theme }) => $final ? theme.fontSizes.md : 'inherit'};
`

const RegisteredBadge = styled.span`
  color: ${({ theme }) => theme.colors.accent};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 400;
`

const GuestBadge = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 400;
`

const GuestAmount = styled.span`
  color: ${({ theme }) => theme.colors.textDim};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: 500;
  margin-left: ${({ theme }) => theme.spacing.sm};
`

const PaidBadge = styled.span`
  color: ${({ theme }) => theme.colors.positive};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 500;
`

const HostingNote = styled.div`
  margin-top: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textDim};
  font-style: italic;
`

const PaymentOverlay = styled.button<{ $confirmed: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ $confirmed }) => $confirmed ? 'rgba(23, 128, 67, 0.85)' : 'transparent'};
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  cursor: pointer;
  transition: background 0.2s ease;
  padding: 0;

  &:hover {
    background: ${({ $confirmed }) => $confirmed ? 'rgba(23, 128, 67, 0.75)' : 'rgba(23, 128, 67, 0.15)'};
  }
`

const CheckmarkSvg = styled.svg<{ $visible: boolean }>`
  opacity: ${({ $visible }) => $visible ? 1 : 0};
  transition: opacity 0.2s ease;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));

  ${PaymentOverlay}:hover & {
    opacity: ${({ $visible }) => $visible ? 1 : 0.4};
  }
`

const AddItemRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.sm};

  ${media.mobile} {
    flex-wrap: wrap;
  }
`

const CardContentRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};

  ${media.mobile} {
    flex-direction: column;
  }
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
  onAddItem: (name: string, price: number, options?: { isPackaging?: boolean }) => void
  onUpdateItem: (itemId: string, updates: Partial<Omit<Item, 'id'>>) => void
  onRemoveItem: (itemId: string) => void
  onFlushItem?: (itemId: string) => void
  // QR Platba props
  bankAccountNumber?: string | null
  creatorPersonId?: string | null
  currentUserPersonId?: string | null
  orderStatus?: 'OPEN' | 'CLOSED'
  orderId?: string
  restaurantName?: string
  isCreator?: boolean
  showCopyQr?: boolean
  paymentConfirmed?: boolean
  onTogglePayment?: () => void
  // Guest / host props
  hostedByName?: string | null
  hostedGuests?: Array<{ name: string; amount: number }>
  chargeableAmount?: number | null
  hostOptions?: HostOption[]
  onChangeHost?: (hostUserId: string) => void
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
  currentUserPersonId,
  orderStatus,
  orderId,
  restaurantName,
  isCreator,
  showCopyQr,
  paymentConfirmed,
  onTogglePayment,
  hostedByName,
  hostedGuests,
  chargeableAmount,
  hostOptions,
  onChangeHost,
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
    onAddItem(suggestion.name, suggestion.price, { isPackaging: suggestion.isPackaging })
    setNewItemName('')
    setNewItemPrice('')
  }

  // Find items shared from other people to this person
  const sharedFromOthers = allPeople
    .filter(p => p.id !== person.id)
    .flatMap(p =>
      p.items
        .filter(item => item.sharedWith.includes(person.id))
        .map(item => ({ item, owner: p }))
    )

  const isGuestPerson = !!hostedByName
  const qrAmount = chargeableAmount ?? summary?.withFees ?? 0

  // QR Platba: show when order is closed, bank account is set, not creator's own card, amount > 0
  // Guests never show their own QR — their host covers them.
  // Creator/admin sees QR on all participant cards; participants see only their own
  const showQr = orderStatus === 'CLOSED'
    && !!bankAccountNumber
    && person.id !== creatorPersonId
    && !isGuestPerson
    && qrAmount > 0
    && !!orderId
    && (isCreator || currentUserPersonId === person.id)

  let spdString: string | null = null
  if (showQr && bankAccountNumber && orderId) {
    try {
      const iban = czechAccountToIban(bankAccountNumber)
      const variableSymbol = generateVariableSymbol(orderId, person.id)
      spdString = buildSpdString({
        iban,
        amount: qrAmount,
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
            {isGuestPerson && <GuestBadge> (guest — hosted by {hostedByName})</GuestBadge>}
            {isGuestPerson && summary && <GuestAmount>{formatCurrency(summary.withFees)}</GuestAmount>}
            {paymentConfirmed && <PaidBadge> (paid)</PaidBadge>}
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

          {summary && (() => {
            const hasHostedGuests = !!hostedGuests && hostedGuests.length > 0 && chargeableAmount !== null && chargeableAmount !== undefined
            // "With fees" is only the FINAL bill when the person isn't hosting anyone and isn't a guest themselves.
            const withFeesIsFinal = !hasHostedGuests && !isGuestPerson
            return (
              <PersonSubtotals>
                <SubtotalItem>Subtotal: {formatCurrency(summary.subtotal)}</SubtotalItem>
                <SubtotalItem>After discount: {formatCurrency(summary.afterDiscount)}</SubtotalItem>
                <SubtotalItem $final={withFeesIsFinal}>
                  With fees: {formatCurrency(summary.withFees)}
                </SubtotalItem>
                {hasHostedGuests && (
                  <SubtotalItem $final>Total: {formatCurrency(chargeableAmount)}</SubtotalItem>
                )}
              </PersonSubtotals>
            )
          })()}
          {hostedGuests && hostedGuests.length > 0 && (
            <HostingNote>
              Hosting {hostedGuests.map(g => `${g.name} (${formatCurrency(g.amount)})`).join(', ')}
            </HostingNote>
          )}
          {isGuestPerson && (
            <HostingNote>
              Covered by {hostedByName}
              {canEditItems && onChangeHost && hostOptions && person.hostUserId && (
                <span style={{ marginLeft: 8 }}>
                  <HostPicker
                    value={person.hostUserId}
                    onChange={onChangeHost}
                    options={hostOptions}
                    label="Change host"
                  />
                </span>
              )}
            </HostingNote>
          )}
        </CardMainContent>

        {spdString && (
          <QrPlatba
            spdString={spdString}
            amount={qrAmount}
            showCopyButton={showCopyQr}
            overlay={isCreator && onTogglePayment ? (
              <PaymentOverlay
                type="button"
                $confirmed={!!paymentConfirmed}
                onClick={e => { e.stopPropagation(); onTogglePayment() }}
                title={paymentConfirmed ? 'Click to unmark payment' : 'Click to mark as paid'}
              >
                <CheckmarkSvg $visible={!!paymentConfirmed} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </CheckmarkSvg>
              </PaymentOverlay>
            ) : undefined}
          />
        )}
      </CardContentRow>
    </Card>
  )
}
