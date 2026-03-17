'use client'

import { useMemo } from 'react'
import { SectionTitle } from '~/features/ui/components/SectionTitle'
import { PersonCard } from './PersonCard'
import { PersonSuggest } from './PersonSuggest'
import type { UserSuggestion } from './PersonSuggest'
import type { Person, Item, PersonSummary } from '../types'
import type { ItemSuggestion } from './ItemSuggest'

interface PeopleSectionProps {
  people: Person[]
  summaries: PersonSummary[]
  globalDiscountPercent: number
  registeredUsers?: UserSuggestion[]
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
  onRemovePerson: (personId: string) => void
  onUpdatePersonName: (personId: string, name: string) => void
  onAddItem: (personId: string, name: string, price: number) => void
  onUpdateItem: (personId: string, itemId: string, updates: Partial<Omit<Item, 'id'>>) => void
  onRemoveItem: (personId: string, itemId: string) => void
}

export function PeopleSection({
  people,
  summaries,
  globalDiscountPercent,
  registeredUsers = [],
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
  onRemovePerson,
  onUpdatePersonName,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
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

  return (
    <div>
      <SectionTitle>People & Orders</SectionTitle>

      {people.map(person => {
        const isEditablePerson = editablePersonId
          ? person.id === editablePersonId
          : canEditItems

        return (
          <PersonCard
            key={person.id}
            person={person}
            allPeople={people}
            summary={summaries.find(s => s.personId === person.id)}
            globalDiscountPercent={globalDiscountPercent}
            itemSuggestions={itemSuggestions}
            canEditItems={isEditablePerson}
            canEditName={editablePersonId ? false : canEditNames}
            canRemove={editablePersonId ? false : canRemovePeople}
            hideShareControls={hideShareControls || !!editablePersonId}
            showEditMyItemsButton={showEditMyItemsForPersonId === person.id}
            onEditMyItems={onEditMyItems}
            onRemovePerson={() => onRemovePerson(person.id)}
            onUpdateName={name => onUpdatePersonName(person.id, name)}
            onAddItem={(name, price) => onAddItem(person.id, name, price)}
            onUpdateItem={(itemId, updates) => onUpdateItem(person.id, itemId, updates)}
            onRemoveItem={itemId => onRemoveItem(person.id, itemId)}
          />
        )
      })}

      {canAddPerson && (
        <PersonSuggest
          onAddPerson={onAddPerson}
          users={registeredUsers}
          excludeUserIds={excludeUserIds}
        />
      )}
    </div>
  )
}
