'use client'

import { useMemo } from 'react'
import { SectionTitle } from '~/features/ui/components/SectionTitle'
import { PersonCard } from './PersonCard'
import { PersonSuggest } from './PersonSuggest'
import type { UserSuggestion } from './PersonSuggest'
import type { Person, Item, PersonSummary } from '../types'
import type { ItemSuggestion } from './ItemSuggest'
import type { GuestSuggestion } from '~/actions/guests'
import { isGuest } from '../utils/calculations'

export type PersonKind = 'creator' | 'self-joined' | 'guest' | 'creator-added'

interface PeopleSectionProps {
  people: Person[]
  summaries: PersonSummary[]
  globalDiscountPercent: number
  registeredUsers?: UserSuggestion[]
  guestSuggestions?: GuestSuggestion[]
  historicalItemSuggestions?: ItemSuggestion[]
  canAddPerson?: boolean
  canEditItems?: boolean
  canEditNames?: boolean
  canRemovePeople?: boolean
  hideShareControls?: boolean
  editablePersonId?: string | null
  showEditMyItemsForPersonId?: string | null
  onEditMyItems?: () => void
  onAddPerson: (name: string, userId?: string) => void
  onAddGuest?: (options: {
    name: string
    hostUserId: string
    guestId?: string
    newGuest?: { name: string; defaultHostUserId: string }
  }) => void
  onUpdatePersonHost?: (personId: string, hostUserId: string) => void
  onRemovePerson: (personId: string) => void
  onUpdatePersonName: (personId: string, name: string) => void
  onAddItem: (personId: string, name: string, price: number, options?: { isPackaging?: boolean }) => void
  onUpdateItem: (personId: string, itemId: string, updates: Partial<Omit<Item, 'id'>>) => void
  onRemoveItem: (personId: string, itemId: string) => void
  onFlushItem?: (personId: string, itemId: string) => void
  // QR Platba props
  bankAccountNumber?: string | null
  creatorPersonId?: string | null
  currentUserPersonId?: string | null
  orderStatus?: 'OPEN' | 'CLOSED'
  orderId?: string
  restaurantName?: string
  isCreator?: boolean
  createdById?: string | null
  paymentConfirmations?: Record<string, { confirmed: boolean; confirmedAt: string | null }>
  onTogglePayment?: (personId: string) => void
}

export function PeopleSection({
  people,
  summaries,
  globalDiscountPercent,
  registeredUsers = [],
  guestSuggestions = [],
  historicalItemSuggestions,
  canAddPerson = false,
  canEditItems = false,
  canEditNames = false,
  canRemovePeople = false,
  hideShareControls = false,
  editablePersonId = null,
  showEditMyItemsForPersonId = null,
  onEditMyItems,
  onAddPerson,
  onAddGuest,
  onUpdatePersonHost,
  onRemovePerson,
  onUpdatePersonName,
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
  createdById,
  paymentConfirmations,
  onTogglePayment,
}: PeopleSectionProps) {
  // Collect all item names+prices across all people for suggestions
  // Historical items go first so current-session items override their prices during dedup
  const itemSuggestions: ItemSuggestion[] = useMemo(() => {
    const all: ItemSuggestion[] = [...(historicalItemSuggestions ?? [])]
    for (const person of people) {
      for (const item of person.items) {
        all.push({ name: item.name, price: item.price })
      }
    }
    return all
  }, [people, historicalItemSuggestions])

  const excludeUserIds = useMemo(
    () => people.filter(p => p.userId).map(p => p.userId!),
    [people],
  )

  const excludeGuestIds = useMemo(
    () => people.filter(p => p.guestId).map(p => p.guestId!),
    [people],
  )

  // Build lookup for host display name and host -> guest list
  const userDisplayNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const u of registeredUsers) map.set(u.id, u.displayName)
    // Also include any people already in the order (covers the session creator too)
    for (const p of people) if (p.userId) map.set(p.userId, p.name)
    return map
  }, [registeredUsers, people])

  const hostedGuestsByHostId = useMemo(() => {
    const map = new Map<string, Array<{ id: string; name: string }>>()
    for (const p of people) {
      if (!isGuest(p) || !p.hostUserId) continue
      const arr = map.get(p.hostUserId) ?? []
      arr.push({ id: p.id, name: p.name })
      map.set(p.hostUserId, arr)
    }
    return map
  }, [people])

  return (
    <div>
      <SectionTitle>People & Orders</SectionTitle>

      {people.map(person => {
        const isEditablePerson = editablePersonId
          ? person.id === editablePersonId
          : canEditItems

        const personIsGuest = isGuest(person)
        const hostedByName = personIsGuest && person.hostUserId
          ? userDisplayNameById.get(person.hostUserId) ?? null
          : null
        const hostedGuestEntries = !personIsGuest && person.userId
          ? hostedGuestsByHostId.get(person.userId) ?? []
          : []
        const hostedGuests = hostedGuestEntries.map(g => ({
          name: g.name,
          amount: summaries.find(s => s.personId === g.id)?.withFees ?? 0,
        }))

        // Chargeable amount: guests owe 0, hosts owe their own + hosted guests' withFees
        let chargeableAmount: number | null = null
        if (personIsGuest) {
          chargeableAmount = 0
        } else if (hostedGuests.length > 0) {
          const ownWithFees = summaries.find(s => s.personId === person.id)?.withFees ?? 0
          const guestsTotal = hostedGuests.reduce((sum, g) => sum + g.amount, 0)
          chargeableAmount = ownWithFees + guestsTotal
        }

        let personKind: PersonKind = 'creator-added'
        if (personIsGuest) personKind = 'guest'
        else if (createdById && person.userId === createdById) personKind = 'creator'
        else if (person.userId) personKind = 'self-joined'

        return (
          <PersonCard
            key={person.id}
            person={person}
            allPeople={people}
            summary={summaries.find(s => s.personId === person.id)}
            globalDiscountPercent={globalDiscountPercent}
            itemSuggestions={itemSuggestions}
            personKind={personKind}
            canEditItems={isEditablePerson}
            canEditName={editablePersonId ? false : canEditNames}
            canRemove={editablePersonId ? false : canRemovePeople}
            hideShareControls={hideShareControls || !!editablePersonId}
            showEditMyItemsButton={showEditMyItemsForPersonId === person.id}
            onEditMyItems={onEditMyItems}
            onRemovePerson={() => onRemovePerson(person.id)}
            onUpdateName={name => onUpdatePersonName(person.id, name)}
            onAddItem={(name, price, options) => onAddItem(person.id, name, price, options)}
            onUpdateItem={(itemId, updates) => onUpdateItem(person.id, itemId, updates)}
            onRemoveItem={itemId => onRemoveItem(person.id, itemId)}
            onFlushItem={onFlushItem ? (itemId: string) => onFlushItem(person.id, itemId) : undefined}
            bankAccountNumber={bankAccountNumber}
            creatorPersonId={creatorPersonId}
            currentUserPersonId={currentUserPersonId}
            orderStatus={orderStatus}
            orderId={orderId}
            restaurantName={restaurantName}
            isCreator={isCreator}
            showCopyQr={isCreator}
            paymentConfirmed={paymentConfirmations?.[person.id]?.confirmed}
            onTogglePayment={onTogglePayment ? () => onTogglePayment(person.id) : undefined}
            hostedByName={hostedByName}
            hostedGuests={hostedGuests}
            chargeableAmount={chargeableAmount}
            hostOptions={registeredUsers.map(u => ({ id: u.id, displayName: u.displayName }))}
            onChangeHost={onUpdatePersonHost ? (hostUserId: string) => onUpdatePersonHost(person.id, hostUserId) : undefined}
          />
        )
      })}

      {canAddPerson && (
        <PersonSuggest
          onAddPerson={onAddPerson}
          onAddGuest={onAddGuest}
          users={registeredUsers}
          guests={guestSuggestions}
          excludeUserIds={excludeUserIds}
          excludeGuestIds={excludeGuestIds}
          hostOptions={registeredUsers.map(u => ({ id: u.id, displayName: u.displayName }))}
        />
      )}
    </div>
  )
}
