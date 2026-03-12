'use client'

import { useState } from 'react'
import styled from 'styled-components'
import { Card } from '~/features/ui/components/Card'
import { Input, NumberInput } from '~/features/ui/components/Input'
import { Button } from '~/features/ui/components/Button'
import { SectionTitle } from '~/features/ui/components/SectionTitle'
import { formatCurrency } from '../utils/formatters'
import type { FeeAdjustment } from '../types'

const SettingsRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`

const Label = styled.label`
  color: ${({ theme }) => theme.colors.text};
  min-width: 140px;
`

const FeeGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 100px 36px 32px;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing.xs};
`

const CzkLabel = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  text-align: center;
`

const NetFeesDisplay = styled.div`
  margin-top: ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.colors.warning};
  font-weight: 500;
`

interface OrderSettingsProps {
  globalDiscountPercent: number
  feeAdjustments: FeeAdjustment[]
  netFees: number
  feePerPerson: number
  peopleCount: number
  onSetGlobalDiscount: (percent: number) => void
  onAddFee: (name: string, amount: number) => void
  onUpdateFee: (id: string, updates: Partial<Omit<FeeAdjustment, 'id'>>) => void
  onRemoveFee: (id: string) => void
}

export function OrderSettings({
  globalDiscountPercent,
  feeAdjustments,
  netFees,
  feePerPerson,
  peopleCount,
  onSetGlobalDiscount,
  onAddFee,
  onUpdateFee,
  onRemoveFee,
}: OrderSettingsProps) {
  const [newFeeName, setNewFeeName] = useState('')
  const [newFeeAmount, setNewFeeAmount] = useState('')

  const handleAddFee = () => {
    const amount = parseFloat(newFeeAmount)
    if (newFeeName.trim() && !isNaN(amount)) {
      onAddFee(newFeeName.trim(), amount)
      setNewFeeName('')
      setNewFeeAmount('')
    }
  }

  const handleAddFeeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAddFee()
  }

  return (
    <Card>
      <SectionTitle>Order Settings</SectionTitle>

      <SettingsRow>
        <Label>Global Discount</Label>
        <NumberInput
          value={globalDiscountPercent || ''}
          onChange={e => onSetGlobalDiscount(parseFloat(e.target.value) || 0)}
          placeholder="0"
          min={0}
          max={100}
          style={{ width: '60px' }}
        />
        <span>%</span>
      </SettingsRow>

      <SectionTitle style={{ fontSize: '1rem', marginTop: '16px' }}>
        Fees & Adjustments
      </SectionTitle>

      {feeAdjustments.map(fee => (
        <FeeGrid key={fee.id}>
          <Input
            value={fee.name}
            onChange={e => onUpdateFee(fee.id, { name: e.target.value })}
          />
          <NumberInput
            value={fee.amount || ''}
            onChange={e => onUpdateFee(fee.id, { amount: parseFloat(e.target.value) || 0 })}
            style={{ width: '100%' }}
          />
          <CzkLabel>CZK</CzkLabel>
          <Button variant="danger" size="sm" onClick={() => onRemoveFee(fee.id)}>
            X
          </Button>
        </FeeGrid>
      ))}

      <FeeGrid>
        <Input
          value={newFeeName}
          onChange={e => setNewFeeName(e.target.value)}
          placeholder="Fee name"
          onKeyDown={handleAddFeeKeyDown}
        />
        <NumberInput
          value={newFeeAmount}
          onChange={e => setNewFeeAmount(e.target.value)}
          placeholder="amount"
          onKeyDown={handleAddFeeKeyDown}
          style={{ width: '100%' }}
        />
        <div />
        <Button variant="secondary" size="sm" onClick={handleAddFee}>
          +
        </Button>
      </FeeGrid>

      {feeAdjustments.some(f => f.amount !== 0) && (
        <NetFeesDisplay>
          Net Fees: {formatCurrency(netFees)} CZK
          {peopleCount > 0 && ` (${formatCurrency(feePerPerson)} / person)`}
        </NetFeesDisplay>
      )}
    </Card>
  )
}
