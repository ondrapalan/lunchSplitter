'use client'

import { useState, useRef, useEffect } from 'react'
import styled from 'styled-components'
import { Input } from '~/features/ui/components/Input'
import { Button } from '~/features/ui/components/Button'

const Wrapper = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.md};
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
  max-height: 160px;
  overflow-y: auto;
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

const AliasHint = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  margin-left: ${({ theme }) => theme.spacing.xs};
`

const GuestHint = styled.span`
  color: ${({ theme }) => theme.colors.textDim};
  font-size: ${({ theme }) => theme.fontSizes.xs};
`

export interface UserSuggestion {
  id: string
  displayName: string
  aliases: string[]
}

interface PersonSuggestProps {
  onAddPerson: (name: string, userId?: string) => void
  users: UserSuggestion[]
  excludeUserIds: string[]
}

export function PersonSuggest({ onAddPerson, users, excludeUserIds }: PersonSuggestProps) {
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const strip = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  const available = users.filter(u => !excludeUserIds.includes(u.id))
  const query = strip(value.trim())
  const filtered = query.length > 0
    ? available.filter(u =>
        strip(u.displayName).includes(query) ||
        u.aliases.some(a => strip(a).includes(query))
      )
    : available

  const getMatchingAlias = (user: UserSuggestion): string | undefined => {
    if (!query || strip(user.displayName).includes(query)) return undefined
    return user.aliases.find(a => strip(a).includes(query))
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

  const handleSelect = (user: UserSuggestion) => {
    onAddPerson(user.displayName, user.id)
    setValue('')
    setOpen(false)
  }

  const handleAddGuest = () => {
    if (value.trim()) {
      onAddPerson(value.trim())
      setValue('')
      setOpen(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (filtered.length > 0 && open) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex(prev => (prev + 1) % filtered.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex(prev => (prev - 1 + filtered.length) % filtered.length)
        return
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && activeIndex >= 0) {
        e.preventDefault()
        handleSelect(filtered[activeIndex])
        return
      }
    }
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddGuest()
    }
  }

  return (
    <Wrapper>
      <InputWrapper ref={wrapperRef}>
        <Input
          value={value}
          onChange={e => {
            setValue(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Person name or select user"
          autoComplete="off"
        />
        {open && filtered.length > 0 && (
          <Dropdown>
            {filtered.map((u, i) => {
              const matchedAlias = getMatchingAlias(u)
              return (
                <Option
                  key={u.id}
                  $active={i === activeIndex}
                  onMouseDown={() => handleSelect(u)}
                >
                  <span>
                    {u.displayName}
                    {matchedAlias && <AliasHint>aka {matchedAlias}</AliasHint>}
                  </span>
                  <UserBadge>user</UserBadge>
                </Option>
              )
            })}
            {value.trim() && !filtered.some(u => strip(u.displayName) === query) && (
              <Option
                $active={false}
                onMouseDown={handleAddGuest}
              >
                <span>{value.trim()}</span>
                <GuestHint>add as guest</GuestHint>
              </Option>
            )}
          </Dropdown>
        )}
      </InputWrapper>
      <Button variant="primary" onClick={handleAddGuest}>
        + Add Person
      </Button>
    </Wrapper>
  )
}
