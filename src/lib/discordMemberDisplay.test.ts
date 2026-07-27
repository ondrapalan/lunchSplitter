import { describe, it, expect } from 'vitest'
import type { DiscordGuildMember } from './discord'
import { memberLabel, normalizeName, sortMembersForDisplay } from './discordMemberDisplay'

function member(overrides: Partial<DiscordGuildMember> = {}): DiscordGuildMember {
  return { discordId: '1', username: 'someone', globalName: null, nick: null, ...overrides }
}

describe('normalizeName', () => {
  it('lowercases and strips diacritics', () => {
    expect(normalizeName('Šárka Nováková')).toBe('sarka novakova')
  })

  it('handles the ring above used in Czech', () => {
    expect(normalizeName('Růžena')).toBe('ruzena')
  })
})

describe('memberLabel', () => {
  it('lists nickname, global name and username', () => {
    expect(memberLabel(member({ nick: 'Domca', globalName: 'Dominik', username: 'dominik99' })))
      .toBe('Domca · Dominik · @dominik99')
  })

  it('omits a missing nickname', () => {
    expect(memberLabel(member({ globalName: 'Jiri H. N.', username: 'jirin' })))
      .toBe('Jiri H. N. · @jirin')
  })

  it('collapses a nickname that only repeats the global name', () => {
    expect(memberLabel(member({ nick: 'cyomi', globalName: 'Cyomi', username: 'cyomi' })))
      .toBe('cyomi · @cyomi')
  })

  it('falls back to the username alone', () => {
    expect(memberLabel(member({ username: 'matous8860' }))).toBe('@matous8860')
  })
})

describe('sortMembersForDisplay', () => {
  it('orders diacritics by Czech collation instead of pushing them last', () => {
    const sorted = sortMembersForDisplay([
      member({ discordId: '1', nick: 'Zdenek' }),
      member({ discordId: '2', nick: 'Šárka' }),
      member({ discordId: '3', nick: 'Radek' }),
    ])
    expect(sorted.map(m => m.nick)).toEqual(['Radek', 'Šárka', 'Zdenek'])
  })

  it('ignores case', () => {
    const sorted = sortMembersForDisplay([
      member({ discordId: '1', nick: 'zdenek' }),
      member({ discordId: '2', nick: 'Adam' }),
    ])
    expect(sorted.map(m => m.nick)).toEqual(['Adam', 'zdenek'])
  })

  it('does not mutate the input', () => {
    const input = [member({ discordId: '1', nick: 'B' }), member({ discordId: '2', nick: 'A' })]
    sortMembersForDisplay(input)
    expect(input.map(m => m.nick)).toEqual(['B', 'A'])
  })
})
