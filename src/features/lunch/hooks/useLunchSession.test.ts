import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useLunchSession } from './useLunchSession'

describe('useLunchSession', () => {
  it('addPerson returns the id of the person it created', () => {
    const { result } = renderHook(() => useLunchSession())

    let personId: string | undefined
    act(() => {
      personId = result.current.addPerson('Ondra', 'user-1')
    })

    expect(typeof personId).toBe('string')
    expect(result.current.session.people).toHaveLength(1)
    expect(result.current.session.people[0].id).toBe(personId)
  })

  it('addPerson returns the explicit id when one is supplied', () => {
    const { result } = renderHook(() => useLunchSession())

    let personId: string | undefined
    act(() => {
      personId = result.current.addPerson('Ondra', 'user-1', 'person-42')
    })

    expect(personId).toBe('person-42')
    expect(result.current.session.people[0].id).toBe('person-42')
  })

  it('addGuest returns the id of the guest it created', () => {
    const { result } = renderHook(() => useLunchSession())

    let personId: string | undefined
    act(() => {
      personId = result.current.addGuest({ name: 'Kamarad', hostUserId: 'user-1' })
    })

    expect(typeof personId).toBe('string')
    expect(result.current.session.people[0].id).toBe(personId)
    expect(result.current.session.people[0].hostUserId).toBe('user-1')
  })

  it('addGuest returns the explicit id when one is supplied', () => {
    const { result } = renderHook(() => useLunchSession())

    let personId: string | undefined
    act(() => {
      personId = result.current.addGuest({ name: 'Kamarad', hostUserId: 'user-1', id: 'person-7' })
    })

    expect(personId).toBe('person-7')
  })
})
