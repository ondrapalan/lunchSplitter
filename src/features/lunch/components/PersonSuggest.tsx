'use client'

import { useState, useRef, useEffect } from 'react'
import styled from 'styled-components'
import { Input } from '~/features/ui/components/Input'
import { Button } from '~/features/ui/components/Button'
import { HostPicker, type HostOption } from './HostPicker'

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.md};
`

const Row = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
`

const InputWrapper = styled.div`
  position: relative;
  flex: 1;
  max-width: 300px;
`

const Dropdown = styled.ul`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 10;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  margin-top: 2px;
  padding: 0;
  list-style: none;
  max-height: 200px;
  overflow-y: auto;
`

const SectionLabel = styled.li`
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: ${({ theme }) => theme.colors.surfaceLight};
`

const Option = styled.li<{ $active: boolean }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  cursor: pointer;
  color: ${({ theme }) => theme.colors.text};
  background: ${({ $active, theme }) => $active ? theme.colors.surfaceLight : 'transparent'};

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceLight};
  }
`

const UserBadge = styled.span`
  color: ${({ theme }) => theme.colors.accent};
  font-size: ${({ theme }) => theme.fontSizes.xs};
`

const GuestBadge = styled.span`
  color: ${({ theme }) => theme.colors.textDim};
  font-size: ${({ theme }) => theme.fontSizes.xs};
`

const AliasHint = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  margin-left: ${({ theme }) => theme.spacing.xs};
`

const GuestHint = styled.span`
  color: ${({ theme }) => theme.colors.textDim};
  font-size: ${({ theme }) => theme.fontSizes.xs};
`

const PendingGuest = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm};
  border: 1px dashed ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  background: ${({ theme }) => theme.colors.surfaceLight};
`

export interface UserSuggestion {
  id: string
  displayName: string
  aliases: string[]
}

export interface GuestSuggestionEntry {
  id: string
  name: string
  aliases: string[]
  defaultHostUserId: string
  defaultHostDisplayName: string
}

interface PersonSuggestProps {
  onAddPerson: (name: string, userId?: string) => void
  onAddGuest?: (options: {
    name: string
    hostUserId: string
    guestId?: string
    newGuest?: { name: string; defaultHostUserId: string }
  }) => void
  users: UserSuggestion[]
  guests?: GuestSuggestionEntry[]
  excludeUserIds: string[]
  excludeGuestIds?: string[]
  hostOptions?: HostOption[]
}

type PendingSelection =
  | { kind: 'existingGuest'; guest: GuestSuggestionEntry; hostUserId: string }
  | { kind: 'newGuest'; name: string; hostUserId: string }
  | null

export function PersonSuggest({
  onAddPerson,
  onAddGuest,
  users,
  guests = [],
  excludeUserIds,
  excludeGuestIds = [],
  hostOptions = [],
}: PersonSuggestProps) {
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [pending, setPending] = useState<PendingSelection>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const strip = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  const availableUsers = users.filter(u => !excludeUserIds.includes(u.id))
  const availableGuests = guests.filter(g => !excludeGuestIds.includes(g.id))
  const query = strip(value.trim())

  const filteredUsers = query.length > 0
    ? availableUsers.filter(u =>
        strip(u.displayName).includes(query) ||
        u.aliases.some(a => strip(a).includes(query))
      )
    : availableUsers

  const filteredGuests = query.length > 0
    ? availableGuests.filter(g =>
        strip(g.name).includes(query) ||
        g.aliases.some(a => strip(a).includes(query))
      )
    : availableGuests

  const totalResults = filteredUsers.length + filteredGuests.length
  const guestOffset = filteredUsers.length
  const canAddNewGuest = value.trim().length > 0
    && !filteredUsers.some(u => strip(u.displayName) === query)
    && !filteredGuests.some(g => strip(g.name) === query)

  const getMatchingAlias = (aliases: string[], displayName: string): string | undefined => {
    if (!query || strip(displayName).includes(query)) return undefined
    return aliases.find(a => strip(a).includes(query))
  }

  useEffect(() => {
    setActiveIndex(-1)
  }, [value])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectUser = (user: UserSuggestion) => {
    onAddPerson(user.displayName, user.id)
    setValue('')
    setOpen(false)
  }

  const handleSelectGuest = (guest: GuestSuggestionEntry) => {
    setPending({ kind: 'existingGuest', guest, hostUserId: guest.defaultHostUserId })
    setValue('')
    setOpen(false)
  }

  const handleStartNewGuest = () => {
    const name = value.trim()
    if (!name) return
    const defaultHost = hostOptions[0]?.id ?? ''
    setPending({ kind: 'newGuest', name, hostUserId: defaultHost })
    setValue('')
    setOpen(false)
  }

  const confirmPending = () => {
    if (!pending || !onAddGuest || !pending.hostUserId) return
    if (pending.kind === 'existingGuest') {
      onAddGuest({
        name: pending.guest.name,
        hostUserId: pending.hostUserId,
        guestId: pending.guest.id,
      })
    } else {
      onAddGuest({
        name: pending.name,
        hostUserId: pending.hostUserId,
        newGuest: { name: pending.name, defaultHostUserId: pending.hostUserId },
      })
    }
    setPending(null)
  }

  const cancelPending = () => setPending(null)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (open && totalResults > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex(prev => (prev + 1) % totalResults)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex(prev => (prev - 1 + totalResults) % totalResults)
        return
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && activeIndex >= 0) {
        e.preventDefault()
        if (activeIndex < filteredUsers.length) {
          handleSelectUser(filteredUsers[activeIndex])
        } else {
          handleSelectGuest(filteredGuests[activeIndex - guestOffset])
        }
        return
      }
    }
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (canAddNewGuest && onAddGuest) {
        handleStartNewGuest()
      }
    }
  }

  return (
    <Wrapper>
      <Row>
        <InputWrapper ref={wrapperRef}>
          <Input
            value={value}
            onChange={e => {
              setValue(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Person name or select user/guest"
            autoComplete="off"
          />
          {open && (totalResults > 0 || canAddNewGuest) && (
            <Dropdown>
              {filteredUsers.length > 0 && <SectionLabel>Registered users</SectionLabel>}
              {filteredUsers.map((u, i) => {
                const matchedAlias = getMatchingAlias(u.aliases, u.displayName)
                return (
                  <Option
                    key={u.id}
                    $active={i === activeIndex}
                    onMouseDown={() => handleSelectUser(u)}
                  >
                    <span>
                      {u.displayName}
                      {matchedAlias && <AliasHint>aka {matchedAlias}</AliasHint>}
                    </span>
                    <UserBadge>user</UserBadge>
                  </Option>
                )
              })}
              {filteredGuests.length > 0 && <SectionLabel>Guests</SectionLabel>}
              {filteredGuests.map((g, i) => {
                const overallIndex = guestOffset + i
                const matchedAlias = getMatchingAlias(g.aliases, g.name)
                return (
                  <Option
                    key={g.id}
                    $active={overallIndex === activeIndex}
                    onMouseDown={() => handleSelectGuest(g)}
                  >
                    <span>
                      {g.name}
                      {matchedAlias && <AliasHint>aka {matchedAlias}</AliasHint>}
                      <GuestHint> · usually {g.defaultHostDisplayName}</GuestHint>
                    </span>
                    <GuestBadge>guest</GuestBadge>
                  </Option>
                )
              })}
              {canAddNewGuest && onAddGuest && (
                <Option
                  $active={false}
                  onMouseDown={handleStartNewGuest}
                >
                  <span>{value.trim()}</span>
                  <GuestHint>add as new guest</GuestHint>
                </Option>
              )}
            </Dropdown>
          )}
        </InputWrapper>
        <Button variant="primary" onClick={() => {
          if (canAddNewGuest && onAddGuest) handleStartNewGuest()
          else if (value.trim()) {
            onAddPerson(value.trim())
            setValue('')
          }
        }}>
          + Add Person
        </Button>
      </Row>

      {pending && (
        <PendingGuest>
          <span>
            {pending.kind === 'existingGuest' ? pending.guest.name : pending.name}
            <GuestHint> (guest)</GuestHint>
          </span>
          <HostPicker
            value={pending.hostUserId}
            onChange={hostUserId => setPending(prev => prev ? { ...prev, hostUserId } : prev)}
            options={hostOptions}
            id="person-suggest-host-picker"
          />
          <Button variant="primary" size="sm" onClick={confirmPending} disabled={!pending.hostUserId}>
            Add
          </Button>
          <Button variant="secondary" size="sm" onClick={cancelPending}>
            Cancel
          </Button>
        </PendingGuest>
      )}
    </Wrapper>
  )
}
