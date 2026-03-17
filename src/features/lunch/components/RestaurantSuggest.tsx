'use client'

import { useState, useRef, useEffect } from 'react'
import styled from 'styled-components'
import { Input } from '~/features/ui/components/Input'

const Wrapper = styled.div`
  position: relative;
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
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  cursor: pointer;
  color: ${({ theme }) => theme.colors.text};
  background: ${({ $active, theme }) => $active ? theme.colors.surfaceLight : 'transparent'};

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceLight};
  }
`

interface RestaurantSuggestProps {
  value: string
  onChange: (value: string) => void
  onSelect?: (name: string) => void
  suggestions: string[]
  placeholder?: string
}

export function RestaurantSuggest({ value, onChange, onSelect, suggestions, placeholder }: RestaurantSuggestProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const filtered = value.trim().length > 0
    ? suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()))
    : suggestions

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

  const handleSelect = (name: string) => {
    onChange(name)
    onSelect?.(name)
    setOpen(false)
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
    }
  }

  return (
    <Wrapper ref={wrapperRef}>
      <Input
        value={value}
        onChange={e => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <Dropdown>
          {filtered.map((name, i) => (
            <Option
              key={name}
              $active={i === activeIndex}
              onMouseDown={() => handleSelect(name)}
            >
              {name}
            </Option>
          ))}
        </Dropdown>
      )}
    </Wrapper>
  )
}
