import { useState, useRef, useEffect } from 'react'
import styled from 'styled-components'
import { Input } from '~/features/ui/components/Input'

const Wrapper = styled.div`
  position: relative;
  flex: 1;
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
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  cursor: pointer;
  color: ${({ theme }) => theme.colors.text};
  background: ${({ $active, theme }) => $active ? theme.colors.surfaceLight : 'transparent'};

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceLight};
  }
`

const PriceHint = styled.span`
  color: ${({ theme }) => theme.colors.textDim};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`

export interface ItemSuggestion {
  name: string
  price: number
}

interface ItemSuggestProps {
  value: string
  onChange: (value: string) => void
  onSelect: (suggestion: ItemSuggestion) => void
  suggestions: ItemSuggestion[]
  onKeyDown?: (e: React.KeyboardEvent) => void
  placeholder?: string
}

export function ItemSuggest({ value, onChange, onSelect, suggestions, onKeyDown, placeholder }: ItemSuggestProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const filtered = value.trim().length > 0
    ? suggestions.filter(s => s.name.toLowerCase().includes(value.toLowerCase()))
    : []

  // Deduplicate by name, keep latest price
  const unique = [...new Map(filtered.map(s => [s.name.toLowerCase(), s])).values()]

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (unique.length > 0 && open) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex(prev => (prev + 1) % unique.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex(prev => (prev - 1 + unique.length) % unique.length)
        return
      }
      if (e.key === 'Tab' && activeIndex >= 0) {
        e.preventDefault()
        onSelect(unique[activeIndex])
        setOpen(false)
        return
      }
      if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault()
        onSelect(unique[activeIndex])
        setOpen(false)
        return
      }
    }
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    onKeyDown?.(e)
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
      {open && unique.length > 0 && (
        <Dropdown>
          {unique.map((s, i) => (
            <Option
              key={s.name}
              $active={i === activeIndex}
              onMouseDown={() => {
                onSelect(s)
                setOpen(false)
              }}
            >
              <span>{s.name}</span>
              <PriceHint>{s.price} CZK</PriceHint>
            </Option>
          ))}
        </Dropdown>
      )}
    </Wrapper>
  )
}
