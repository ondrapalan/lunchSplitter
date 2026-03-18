'use client'

import { useState } from 'react'
import styled from 'styled-components'
import { media } from '~/features/ui/theme'
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

  ${media.mobile} {
    flex-direction: column;
    align-items: flex-start;
  }
`

const Label = styled.label`
  color: ${({ theme }) => theme.colors.text};
  min-width: 140px;

  ${media.mobile} {
    min-width: auto;
  }
`

const FeeGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 100px 36px 32px;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing.xs};

  ${media.mobile} {
    grid-template-columns: 1fr 80px 28px 28px;
    gap: 4px;
  }
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

const WarningText = styled.span`
  color: ${({ theme }) => theme.colors.warning};
  font-size: ${({ theme }) => theme.fontSizes.xs};
`

interface OrderSettingsProps {
  globalDiscountPercent: number
  feeAdjustments: FeeAdjustment[]
  netFees: number
  feePerPerson: number
  peopleCount: number
  editable?: boolean
  bankAccountNumber?: string | null
  onBankAccountChange?: (value: string) => void
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
  editable = true,
  bankAccountNumber,
  onBankAccountChange,
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
        <Label>Bank Account</Label>
        {editable ? (
          <div>
            <Input
              value={bankAccountNumber ?? ''}
              onChange={e => onBankAccountChange?.(e.target.value)}
              placeholder="e.g. 123456789/0800"
            />
            {!bankAccountNumber && <WarningText>QR codes won&apos;t be generated</WarningText>}
          </div>
        ) : (
          <span>{bankAccountNumber || <WarningText>Not set</WarningText>}</span>
        )}
      </SettingsRow>

      <SettingsRow>
        <Label>Global Discount</Label>
        {editable ? (
          <>
            <NumberInput
              value={globalDiscountPercent || ''}
              onChange={e => onSetGlobalDiscount(parseFloat(e.target.value) || 0)}
              placeholder="0"
              min={0}
              max={100}
              style={{ width: '60px' }}
            />
            <span>%</span>
          </>
        ) : (
          <span>{globalDiscountPercent}%</span>
        )}
      </SettingsRow>

      <SectionTitle style={{ fontSize: '1rem', marginTop: '16px' }}>
        Fees & Adjustments
      </SectionTitle>

      {feeAdjustments.map(fee => (
        <FeeGrid key={fee.id}>
          {editable ? (
            <>
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
            </>
          ) : (
            <>
              <span>{fee.name}</span>
              <span style={{ textAlign: 'right' }}>{fee.amount} CZK</span>
              <span />
              <span />
            </>
          )}
        </FeeGrid>
      ))}

      {editable && (
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
      )}

      {feeAdjustments.some(f => f.amount !== 0) && (
        <NetFeesDisplay>
          Net Fees: {formatCurrency(netFees)} CZK
          {peopleCount > 0 && ` (${formatCurrency(feePerPerson)} / person)`}
        </NetFeesDisplay>
      )}
    </Card>
  )
}
