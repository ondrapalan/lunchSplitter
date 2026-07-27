import { useState } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { darkTheme } from '~/features/ui/theme'
import { PeopleSection } from './PeopleSection'
import type { Person } from '../types'

const USERS = [
  { id: 'user-1', displayName: 'Ondra', aliases: [] },
  { id: 'user-2', displayName: 'Petr', aliases: [] },
]

const GUESTS = [
  {
    id: 'guest-1',
    name: 'Kamarad',
    aliases: [],
    defaultHostUserId: 'user-1',
    defaultHostDisplayName: 'Ondra',
  },
]

function Harness() {
  const [people, setPeople] = useState<Person[]>([
    { id: 'person-1', name: 'Ondra', userId: 'user-1', items: [] },
  ])
  const [renderToken, setRenderToken] = useState(0)

  const addPerson = (name: string, userId?: string) => {
    const id = `person-${name}`
    setPeople(prev => [...prev, { id, name, userId: userId ?? null, items: [] }])
    return id
  }

  const addGuest = (options: { name: string; hostUserId: string }) => {
    const id = `person-${options.name}`
    setPeople(prev => [
      ...prev,
      {
        id,
        name: options.name,
        userId: null,
        guestId: 'guest-1',
        hostUserId: options.hostUserId,
        items: [],
      },
    ])
    return id
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <button onClick={() => setRenderToken(token => token + 1)}>rerender {renderToken}</button>
      <PeopleSection
        people={people}
        summaries={[]}
        globalDiscountPercent={0}
        registeredUsers={USERS}
        guestSuggestions={GUESTS}
        canAddPerson
        canEditItems
        onAddPerson={addPerson}
        onAddGuest={addGuest}
        onRemovePerson={() => {}}
        onUpdatePersonName={() => {}}
        onAddItem={() => {}}
        onUpdateItem={() => {}}
        onRemoveItem={() => {}}
      />
    </ThemeProvider>
  )
}

const itemInputs = () => screen.getAllByPlaceholderText('Item name')

function pickFromPicker(query: string) {
  const picker = screen.getByPlaceholderText('Person name or select user/guest')
  fireEvent.focus(picker)
  fireEvent.change(picker, { target: { value: query } })
  fireEvent.keyDown(picker, { key: 'ArrowDown' })
  fireEvent.keyDown(picker, { key: 'Enter' })
}

describe('PeopleSection', () => {
  it('focuses the item input of a newly added registered user', () => {
    render(<Harness />)
    expect(itemInputs()).toHaveLength(1)

    pickFromPicker('Petr')

    const inputs = itemInputs()
    expect(inputs).toHaveLength(2)
    expect(inputs[1]).toHaveFocus()
    expect(inputs[0]).not.toHaveFocus()
  })

  it('focuses the item input of a newly added guest', () => {
    render(<Harness />)

    pickFromPicker('Kamarad')
    fireEvent.click(screen.getByText('Add'))

    const inputs = itemInputs()
    expect(inputs).toHaveLength(2)
    expect(inputs[1]).toHaveFocus()
  })

  it('focuses the item input of a person added by typed name', () => {
    render(<Harness />)

    const picker = screen.getByPlaceholderText('Person name or select user/guest')
    fireEvent.change(picker, { target: { value: 'Petr' } })
    fireEvent.click(screen.getByText('+ Add Person'))

    const inputs = itemInputs()
    expect(inputs).toHaveLength(2)
    expect(inputs[1]).toHaveFocus()
  })

  it('does not steal focus back on an unrelated re-render', () => {
    render(<Harness />)
    pickFromPicker('Petr')

    itemInputs()[1].blur()
    expect(itemInputs()[1]).not.toHaveFocus()

    fireEvent.click(screen.getByText(/rerender/))

    expect(itemInputs()[1]).not.toHaveFocus()
    expect(itemInputs()[0]).not.toHaveFocus()
  })
})
