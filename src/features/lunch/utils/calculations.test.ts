import { describe, it, expect } from 'vitest'
import { calculatePersonSummaries, calculateNetFees, calculateFeePerPerson } from './calculations'
import type { LunchSession } from '../types'

describe('calculateNetFees', () => {
  it('sums positive and negative adjustments', () => {
    const fees = [
      { id: '1', name: 'Service', amount: 30 },
      { id: '2', name: 'Delivery', amount: 39 },
      { id: '3', name: 'Coupon', amount: -25 },
    ]
    expect(calculateNetFees(fees)).toBe(44)
  })

  it('returns 0 for empty fees', () => {
    expect(calculateNetFees([])).toBe(0)
  })
})

describe('calculateFeePerPerson', () => {
  it('splits fees equally among people', () => {
    expect(calculateFeePerPerson(44, 5)).toBeCloseTo(8.8)
  })

  it('returns 0 when no people', () => {
    expect(calculateFeePerPerson(44, 0)).toBe(0)
  })
})

describe('calculatePersonSummaries', () => {
  it('calculates the exampleLunch.txt scenario correctly', () => {
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
            { id: 'i2', name: 'Parizska rychlovka', price: 69, discountPercent: null, sharedWith: [], customShares: null },
          ],
        },
        {
          id: 'bary', name: 'Bary', items: [
            { id: 'i3', name: 'Sweet chili', price: 129, discountPercent: null, sharedWith: [], customShares: null },
            { id: 'i4', name: 'Caesar', price: 154, discountPercent: null, sharedWith: [], customShares: null },
          ],
        },
        {
          id: 'ja', name: 'Ja', items: [
            { id: 'i5', name: 'Sweet chili', price: 129, discountPercent: null, sharedWith: [], customShares: null },
            { id: 'i6', name: 'Parizska', price: 139, discountPercent: null, sharedWith: [], customShares: null },
          ],
        },
        {
          id: 'lukas', name: 'Lukas', items: [
            { id: 'i7', name: 'Caesar menu', price: 292, discountPercent: null, sharedWith: [], customShares: null },
          ],
        },
        {
          id: 'jira', name: 'Jira', items: [
            { id: 'i8', name: 'Caesar menu', price: 292, discountPercent: null, sharedWith: [], customShares: null },
          ],
        },
      ],
    }

    const summaries = calculatePersonSummaries(session)

    expect(summaries).toHaveLength(5)

    const domca = summaries.find(s => s.personId === 'domca')!
    expect(domca.subtotal).toBe(233)
    expect(domca.afterDiscount).toBeCloseTo(139.8)
    expect(domca.withFees).toBeCloseTo(148.6)

    const bary = summaries.find(s => s.personId === 'bary')!
    expect(bary.subtotal).toBe(283)
    expect(bary.afterDiscount).toBeCloseTo(169.8)
    expect(bary.withFees).toBeCloseTo(178.6)

    const ja = summaries.find(s => s.personId === 'ja')!
    expect(ja.subtotal).toBe(268)
    expect(ja.afterDiscount).toBeCloseTo(160.8)
    expect(ja.withFees).toBeCloseTo(169.6)

    const lukas = summaries.find(s => s.personId === 'lukas')!
    expect(lukas.subtotal).toBe(292)
    expect(lukas.afterDiscount).toBeCloseTo(175.2)
    expect(lukas.withFees).toBeCloseTo(184)

    const jira = summaries.find(s => s.personId === 'jira')!
    expect(jira.subtotal).toBe(292)
    expect(jira.afterDiscount).toBeCloseTo(175.2)
    expect(jira.withFees).toBeCloseTo(184)
  })

  it('splits shared items equally among sharers', () => {
    const session: LunchSession = {
      globalDiscountPercent: 0,
      feeAdjustments: [],
      people: [
        {
          id: 'a', name: 'Alice', items: [
            { id: 'i1', name: 'Family Menu', price: 300, discountPercent: null, sharedWith: ['b', 'c'], customShares: null },
          ],
        },
        { id: 'b', name: 'Bob', items: [] },
        { id: 'c', name: 'Charlie', items: [] },
      ],
    }

    const summaries = calculatePersonSummaries(session)

    expect(summaries.find(s => s.personId === 'a')!.subtotal).toBe(100)
    expect(summaries.find(s => s.personId === 'b')!.subtotal).toBe(100)
    expect(summaries.find(s => s.personId === 'c')!.subtotal).toBe(100)
  })

  it('applies per-item discount override instead of global', () => {
    const session: LunchSession = {
      globalDiscountPercent: 40,
      feeAdjustments: [],
      people: [
        {
          id: 'a', name: 'Alice', items: [
            { id: 'i1', name: 'Regular', price: 100, discountPercent: null, sharedWith: [], customShares: null },
            { id: 'i2', name: 'Special', price: 100, discountPercent: 20, sharedWith: [], customShares: null },
          ],
        },
      ],
    }

    const summaries = calculatePersonSummaries(session)
    const alice = summaries.find(s => s.personId === 'a')!

    // Regular: 100 * 0.6 = 60, Special: 100 * 0.8 = 80
    expect(alice.afterDiscount).toBeCloseTo(140)
  })

  it('handles custom shares with discount', () => {
    const session: LunchSession = {
      globalDiscountPercent: 50,
      feeAdjustments: [],
      people: [
        {
          id: 'a', name: 'Alice', items: [
            {
              id: 'i1', name: 'Family Menu', price: 400,
              discountPercent: null,
              sharedWith: ['b'],
              customShares: { a: 250, b: 150 },
            },
          ],
        },
        { id: 'b', name: 'Bob', items: [] },
      ],
    }

    const summaries = calculatePersonSummaries(session)

    // Alice: 250 * 0.5 = 125, Bob: 150 * 0.5 = 75
    expect(summaries.find(s => s.personId === 'a')!.subtotal).toBe(250)
    expect(summaries.find(s => s.personId === 'a')!.afterDiscount).toBeCloseTo(125)
    expect(summaries.find(s => s.personId === 'b')!.subtotal).toBe(150)
    expect(summaries.find(s => s.personId === 'b')!.afterDiscount).toBeCloseTo(75)
  })

  it('handles zero discount', () => {
    const session: LunchSession = {
      globalDiscountPercent: 0,
      feeAdjustments: [],
      people: [
        {
          id: 'a', name: 'Alice', items: [
            { id: 'i1', name: 'Lunch', price: 200, discountPercent: null, sharedWith: [], customShares: null },
          ],
        },
      ],
    }

    const summaries = calculatePersonSummaries(session)
    expect(summaries[0].subtotal).toBe(200)
    expect(summaries[0].afterDiscount).toBe(200)
    expect(summaries[0].withFees).toBe(200)
  })
})
