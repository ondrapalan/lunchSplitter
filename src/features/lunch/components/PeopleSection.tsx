import { useState, useMemo } from 'react'
import styled from 'styled-components'
import { Input } from '~/features/ui/components/Input'
import { Button } from '~/features/ui/components/Button'
import { SectionTitle } from '~/features/ui/components/SectionTitle'
import { PersonCard } from './PersonCard'
import type { Person, Item, PersonSummary } from '../types'
import type { ItemSuggestion } from './ItemSuggest'

const AddPersonRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.md};
`

interface PeopleSectionProps {
  people: Person[]
  summaries: PersonSummary[]
  globalDiscountPercent: number
  onAddPerson: (name: string) => void
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
  onAddPerson,
  onRemovePerson,
  onUpdatePersonName,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
}: PeopleSectionProps) {
  const [newPersonName, setNewPersonName] = useState('')

  const handleAddPerson = () => {
    if (newPersonName.trim()) {
      onAddPerson(newPersonName.trim())
      setNewPersonName('')
    }
  }

  // Collect all item names+prices across all people for suggestions
  const itemSuggestions: ItemSuggestion[] = useMemo(() => {
    const all: ItemSuggestion[] = []
    for (const person of people) {
      for (const item of person.items) {
        all.push({ name: item.name, price: item.price })
      }
    }
    return all
  }, [people])

  return (
    <div>
      <SectionTitle>People & Orders</SectionTitle>

      {people.map(person => (
        <PersonCard
          key={person.id}
          person={person}
          allPeople={people}
          summary={summaries.find(s => s.personId === person.id)}
          globalDiscountPercent={globalDiscountPercent}
          itemSuggestions={itemSuggestions}
          onRemovePerson={() => onRemovePerson(person.id)}
          onUpdateName={name => onUpdatePersonName(person.id, name)}
          onAddItem={(name, price) => onAddItem(person.id, name, price)}
          onUpdateItem={(itemId, updates) => onUpdateItem(person.id, itemId, updates)}
          onRemoveItem={itemId => onRemoveItem(person.id, itemId)}
        />
      ))}

      <AddPersonRow>
        <Input
          value={newPersonName}
          onChange={e => setNewPersonName(e.target.value)}
          placeholder="Person name"
          onKeyDown={e => {
            if (e.key === 'Enter') handleAddPerson()
          }}
          style={{ flex: 1, maxWidth: '300px' }}
        />
        <Button variant="primary" onClick={handleAddPerson}>
          + Add Person
        </Button>
      </AddPersonRow>
    </div>
  )
}
