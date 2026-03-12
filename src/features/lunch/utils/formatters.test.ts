import { describe, it, expect } from 'vitest'
import { formatCurrency, formatFeeAmount, generateCopySummary, wasEdited } from './formatters'
import type { LunchSession, PersonSummary } from '../types'

describe('formatCurrency', () => {
  it('formats number to 2 decimal places', () => {
    expect(formatCurrency(139.8)).toBe('139.80')
    expect(formatCurrency(184)).toBe('184.00')
    expect(formatCurrency(8.8)).toBe('8.80')
  })
})

describe('formatFeeAmount', () => {
  it('formats positive as + X', () => {
    expect(formatFeeAmount(30)).toBe('+30')
  })

  it('formats negative as -X', () => {
    expect(formatFeeAmount(-25)).toBe('-25')
  })
})

describe('wasEdited', () => {
  it('returns false when timestamps are within 10 seconds', () => {
    expect(wasEdited('2026-01-01T00:00:00Z', '2026-01-01T00:00:05Z')).toBe(false)
  })

  it('returns true when timestamps differ by more than 10 seconds', () => {
    expect(wasEdited('2026-01-01T00:00:00Z', '2026-01-01T00:01:00Z')).toBe(true)
  })

  it('returns false when timestamps are identical', () => {
    expect(wasEdited('2026-01-01T12:00:00Z', '2026-01-01T12:00:00Z')).toBe(false)
  })
})

describe('generateCopySummary', () => {
  it('generates text summary matching expected format', () => {
    const session: LunchSession = {
      globalDiscountPercent: 40,
      feeAdjustments: [
        { id: '1', name: 'Service Fee', amount: 30 },
        { id: '2', name: 'Delivery Fee', amount: 39 },
        { id: '3', name: 'Delivery Coupon', amount: -25 },
      ],
      people: [
        {
          id: 'domca', name: 'Domca', items: [
            { id: 'i1', name: 'Grilled roastbeef', price: 164, discountPercent: null, sharedWith: [], customShares: null },
          ],
        },
      ],
    }

    const summaries: PersonSummary[] = [
      { personId: 'domca', name: 'Domca', subtotal: 164, afterDiscount: 98.4, withFees: 107.2 },
    ]

    const text = generateCopySummary(session, summaries)

    expect(text).toContain('Domca:')
    expect(text).toContain('Grilled roastbeef')
    expect(text).toContain('164')
    expect(text).toContain('Subtotal:')
    expect(text).toContain('After discount:')
    expect(text).toContain('With fees:')
    expect(text).toContain('Discount: 40%')
    expect(text).toContain('Service Fee')
  })
})
