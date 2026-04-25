import { describe, it, expect } from 'vitest'
import {
  calculatePersonSummaries,
  calculateNetFees,
  calculateFeePerPerson,
  calculateChargeableAmount,
} from './calculations'
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
            { id: 'i1', name: 'Grilled roastbeef', price: 164, discountPercent: null, isPackaging: false, sharedWith: [], customShares: null },
            { id: 'i2', name: 'Parizska rychlovka', price: 69, discountPercent: null, isPackaging: false, sharedWith: [], customShares: null },
          ],
        },
        {
          id: 'bary', name: 'Bary', items: [
            { id: 'i3', name: 'Sweet chili', price: 129, discountPercent: null, isPackaging: false, sharedWith: [], customShares: null },
            { id: 'i4', name: 'Caesar', price: 154, discountPercent: null, isPackaging: false, sharedWith: [], customShares: null },
          ],
        },
        {
          id: 'ja', name: 'Ja', items: [
            { id: 'i5', name: 'Sweet chili', price: 129, discountPercent: null, isPackaging: false, sharedWith: [], customShares: null },
            { id: 'i6', name: 'Parizska', price: 139, discountPercent: null, isPackaging: false, sharedWith: [], customShares: null },
          ],
        },
        {
          id: 'lukas', name: 'Lukas', items: [
            { id: 'i7', name: 'Caesar menu', price: 292, discountPercent: null, isPackaging: false, sharedWith: [], customShares: null },
          ],
        },
        {
          id: 'jira', name: 'Jira', items: [
            { id: 'i8', name: 'Caesar menu', price: 292, discountPercent: null, isPackaging: false, sharedWith: [], customShares: null },
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
            { id: 'i1', name: 'Family Menu', price: 300, discountPercent: null, isPackaging: false, sharedWith: ['b', 'c'], customShares: null },
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
            { id: 'i1', name: 'Regular', price: 100, discountPercent: null, isPackaging: false, sharedWith: [], customShares: null },
            { id: 'i2', name: 'Special', price: 100, discountPercent: 20, isPackaging: false, sharedWith: [], customShares: null },
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
              isPackaging: false,
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
            { id: 'i1', name: 'Lunch', price: 200, discountPercent: null, isPackaging: false, sharedWith: [], customShares: null },
          ],
        },
      ],
    }

    const summaries = calculatePersonSummaries(session)
    expect(summaries[0].subtotal).toBe(200)
    expect(summaries[0].afterDiscount).toBe(200)
    expect(summaries[0].withFees).toBe(200)
  })

  // Pins the M1 product decision: fees are split evenly across ALL people,
  // creator included. The creator pays their own meal + fees/N share; QR DMs
  // skip the creator because they pay themselves. A future "creator excluded
  // from denominator" refactor would break this expectation deliberately.
  it('splits fees evenly across all people including the creator', () => {
    const session: LunchSession = {
      globalDiscountPercent: 0,
      feeAdjustments: [{ id: 'f1', name: 'Delivery', amount: 100 }],
      people: [
        { id: 'creator', name: 'Creator', userId: 'u1', items: [] },
        { id: 'p2', name: 'P2', userId: 'u2', items: [] },
        { id: 'p3', name: 'P3', userId: 'u3', items: [] },
        { id: 'p4', name: 'P4', userId: 'u4', items: [] },
        { id: 'p5', name: 'P5', userId: 'u5', items: [] },
      ],
    }

    const summaries = calculatePersonSummaries(session)
    for (const summary of summaries) {
      expect(summary.withFees).toBeCloseTo(20)
    }
  })
})

describe('calculateChargeableAmount', () => {
  it('returns 0 for a guest person', () => {
    const session: LunchSession = {
      globalDiscountPercent: 0,
      feeAdjustments: [],
      people: [
        {
          id: 'guest1', name: 'Guest', guestId: 'g1', hostUserId: 'host-user',
          items: [{ id: 'i1', name: 'Soup', price: 100, discountPercent: null, isPackaging: false, sharedWith: [], customShares: null }],
        },
      ],
    }

    expect(calculateChargeableAmount('guest1', session)).toBe(0)
  })

  it('returns own withFees for a registered user with no hosted guests', () => {
    const session: LunchSession = {
      globalDiscountPercent: 0,
      feeAdjustments: [],
      people: [
        {
          id: 'p1', name: 'Alice', userId: 'user-1',
          items: [{ id: 'i1', name: 'Salad', price: 150, discountPercent: null, isPackaging: false, sharedWith: [], customShares: null }],
        },
      ],
    }

    expect(calculateChargeableAmount('p1', session)).toBeCloseTo(150)
  })

  it('adds the share of one hosted guest', () => {
    const session: LunchSession = {
      globalDiscountPercent: 0,
      feeAdjustments: [],
      people: [
        {
          id: 'host-person', name: 'Host', userId: 'user-1',
          items: [{ id: 'i1', name: 'Pizza', price: 200, discountPercent: null, isPackaging: false, sharedWith: [], customShares: null }],
        },
        {
          id: 'guest-person', name: 'Guest', guestId: 'g1', hostUserId: 'user-1',
          items: [{ id: 'i2', name: 'Burger', price: 180, discountPercent: null, isPackaging: false, sharedWith: [], customShares: null }],
        },
      ],
    }

    // Host pays for own (200) + guest's (180) = 380
    expect(calculateChargeableAmount('host-person', session)).toBeCloseTo(380)
  })

  it('adds the shares of multiple hosted guests', () => {
    const session: LunchSession = {
      globalDiscountPercent: 0,
      feeAdjustments: [],
      people: [
        {
          id: 'host-person', name: 'Host', userId: 'user-1',
          items: [{ id: 'i1', name: 'Pizza', price: 200, discountPercent: null, isPackaging: false, sharedWith: [], customShares: null }],
        },
        {
          id: 'g1', name: 'Guest A', guestId: 'guest-a', hostUserId: 'user-1',
          items: [{ id: 'i2', name: 'Burger', price: 100, discountPercent: null, isPackaging: false, sharedWith: [], customShares: null }],
        },
        {
          id: 'g2', name: 'Guest B', guestId: 'guest-b', hostUserId: 'user-1',
          items: [{ id: 'i3', name: 'Pasta', price: 150, discountPercent: null, isPackaging: false, sharedWith: [], customShares: null }],
        },
        {
          // Different host's guest — must NOT be included in user-1's chargeable amount
          id: 'g3', name: 'Guest C', guestId: 'guest-c', hostUserId: 'user-2',
          items: [{ id: 'i4', name: 'Steak', price: 500, discountPercent: null, isPackaging: false, sharedWith: [], customShares: null }],
        },
      ],
    }

    expect(calculateChargeableAmount('host-person', session)).toBeCloseTo(450)
  })

  it('returns 0 when personId is not in the session', () => {
    const session: LunchSession = {
      globalDiscountPercent: 0,
      feeAdjustments: [],
      people: [
        { id: 'p1', name: 'Alice', userId: 'user-1', items: [] },
      ],
    }

    expect(calculateChargeableAmount('does-not-exist', session)).toBe(0)
  })

  it('reuses pre-computed summaries when provided', () => {
    const session: LunchSession = {
      globalDiscountPercent: 0,
      feeAdjustments: [],
      people: [
        {
          id: 'p1', name: 'Alice', userId: 'user-1',
          items: [{ id: 'i1', name: 'Lunch', price: 200, discountPercent: null, isPackaging: false, sharedWith: [], customShares: null }],
        },
      ],
    }
    const summaries = calculatePersonSummaries(session)
    expect(calculateChargeableAmount('p1', session, summaries)).toBeCloseTo(200)
  })
})
