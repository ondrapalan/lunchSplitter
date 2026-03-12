'use client'

import { useState } from 'react'
import styled from 'styled-components'
import { NumberInput } from '~/features/ui/components/Input'
import { Button } from '~/features/ui/components/Button'
import type { Item, Person } from '../types'

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.xs} 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};

  &:last-of-type {
    border-bottom: none;
  }
`

const ItemName = styled.span`
  flex: 1;
  color: ${({ theme }) => theme.colors.text};
`

const ItemPrice = styled.span`
  color: ${({ theme }) => theme.colors.positive};
  min-width: 70px;
  text-align: right;
`

const DiscountBadge = styled.button<{ $custom: boolean }>`
  background: ${({ $custom }) => $custom ? 'rgba(199, 146, 234, 0.15)' : 'rgba(84, 110, 122, 0.2)'};
  color: ${({ $custom, theme }) => $custom ? theme.colors.accent : theme.colors.textDim};
  border: 1px solid ${({ $custom, theme }) => $custom ? theme.colors.accent : 'transparent'};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: 2px 6px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  cursor: pointer;

  &:hover {
    opacity: 0.8;
  }
`

const SharedBadge = styled.div`
  color: ${({ theme }) => theme.colors.secondary};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  margin-top: 2px;
`

const ShareSelector = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
`

const ShareOption = styled.button<{ $selected: boolean }>`
  background: ${({ $selected, theme }) => $selected ? theme.colors.secondary : 'transparent'};
  color: ${({ $selected, theme }) => $selected ? theme.colors.background : theme.colors.textMuted};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: 2px 8px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  cursor: pointer;
`

const ItemDetails = styled.div`
  flex: 1;
`

interface ItemRowProps {
  item: Item
  globalDiscountPercent: number
  allPeople: Person[]
  ownerId: string
  onUpdate: (updates: Partial<Omit<Item, 'id'>>) => void
  onRemove: () => void
}

export function ItemRow({ item, globalDiscountPercent, allPeople, ownerId, onUpdate, onRemove }: ItemRowProps) {
  const [editingDiscount, setEditingDiscount] = useState(false)
  const [showShareSelector, setShowShareSelector] = useState(false)

  const effectiveDiscount = item.discountPercent !== null ? item.discountPercent : globalDiscountPercent
  const isCustomDiscount = item.discountPercent !== null
  const otherPeople = allPeople.filter(p => p.id !== ownerId)
  const sharerCount = item.sharedWith.length > 0 ? item.sharedWith.length + 1 : 1
  const shareAmount = item.price / sharerCount

  const handleDiscountClick = () => {
    if (editingDiscount) return
    setEditingDiscount(true)
  }

  const handleDiscountChange = (value: string) => {
    const num = parseFloat(value)
    if (value === '' || value === 'global') {
      onUpdate({ discountPercent: null })
      setEditingDiscount(false)
    } else if (!isNaN(num)) {
      onUpdate({ discountPercent: num })
    }
  }

  const handleDiscountBlur = () => {
    setEditingDiscount(false)
  }

  const toggleShare = (personId: string) => {
    const newSharedWith = item.sharedWith.includes(personId)
      ? item.sharedWith.filter(id => id !== personId)
      : [...item.sharedWith, personId]
    onUpdate({ sharedWith: newSharedWith })
  }

  return (
    <div>
      <Row>
        <ItemDetails>
          <ItemName>{item.name}</ItemName>
          {item.sharedWith.length > 0 && (
            <SharedBadge>
              Shared with: {item.sharedWith.map(id => allPeople.find(p => p.id === id)?.name).filter(Boolean).join(', ')}
              {' '}(your share: {shareAmount.toFixed(2)} CZK)
            </SharedBadge>
          )}
        </ItemDetails>
        <ItemPrice>{item.price} CZK</ItemPrice>
        {editingDiscount ? (
          <NumberInput
            autoFocus
            defaultValue={item.discountPercent ?? ''}
            placeholder="global"
            onBlur={handleDiscountBlur}
            onChange={e => handleDiscountChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleDiscountBlur()
              if (e.key === 'Escape') {
                onUpdate({ discountPercent: null })
                setEditingDiscount(false)
              }
            }}
            style={{ width: '60px' }}
            min={0}
            max={100}
          />
        ) : (
          <DiscountBadge $custom={isCustomDiscount} onClick={handleDiscountClick}>
            {isCustomDiscount ? `${effectiveDiscount}%` : `global ${effectiveDiscount}%`}
          </DiscountBadge>
        )}
        <Button variant="ghost" size="sm" onClick={() => setShowShareSelector(!showShareSelector)}>
          {showShareSelector ? 'Hide' : 'Share'}
        </Button>
        <Button variant="danger" size="sm" onClick={onRemove}>X</Button>
      </Row>
      {showShareSelector && otherPeople.length > 0 && (
        <ShareSelector>
          {otherPeople.map(p => (
            <ShareOption
              key={p.id}
              $selected={item.sharedWith.includes(p.id)}
              onClick={() => toggleShare(p.id)}
            >
              {p.name}
            </ShareOption>
          ))}
        </ShareSelector>
      )}
    </div>
  )
}
