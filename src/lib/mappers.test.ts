import { describe, it, expect } from 'vitest'
import { prismaOrderToLunchSession, lunchSessionToPrismaInput } from './mappers'
import type { LunchSession } from '~/features/lunch/types'

describe('prismaOrderToLunchSession', () => {
  it('converts a minimal order with no people', () => {
    const order = {
      id: 'order-1',
      restaurantId: 'rest-1',
      globalDiscountPercent: 10,
      bankAccountNumber: null,
      createdById: 'user-1',
      status: 'OPEN' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      feeAdjustments: [
        { id: 'fee-1', name: 'Delivery', amount: 50, sortOrder: 0, orderId: 'order-1' },
      ],
      people: [],
    }

    const session = prismaOrderToLunchSession(order)

    expect(session.globalDiscountPercent).toBe(10)
    expect(session.feeAdjustments).toEqual([
      { id: 'fee-1', name: 'Delivery', amount: 50 },
    ])
    expect(session.people).toEqual([])
  })

  it('converts people with items, shared links, and custom shares', () => {
    const order = {
      id: 'order-1',
      restaurantId: 'rest-1',
      globalDiscountPercent: 0,
      bankAccountNumber: null,
      createdById: 'user-1',
      status: 'OPEN' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      feeAdjustments: [],
      people: [
        {
          id: 'person-1',
          name: 'Alice',
          sortOrder: 0,
          orderId: 'order-1',
          userId: 'user-alice',
          items: [
            {
              id: 'item-1',
              name: 'Pizza',
              price: 200,
              discountPercent: null,
              sortOrder: 0,
              personId: 'person-1',
              sharedWith: [
                { id: 'link-1', itemId: 'item-1', personId: 'person-2' },
              ],
              customShares: [
                { id: 'cs-1', itemId: 'item-1', personId: 'person-2', amount: 80 },
              ],
            },
          ],
        },
        {
          id: 'person-2',
          name: 'Bob',
          sortOrder: 1,
          orderId: 'order-1',
          userId: null,
          items: [],
        },
      ],
    }

    const session = prismaOrderToLunchSession(order)

    expect(session.people).toHaveLength(2)
    expect(session.people[0].name).toBe('Alice')
    expect(session.people[0].userId).toBe('user-alice')
    expect(session.people[0].items[0].sharedWith).toEqual(['person-2'])
    expect(session.people[0].items[0].customShares).toEqual({ 'person-2': 80 })
    expect(session.people[1].name).toBe('Bob')
    expect(session.people[1].userId).toBeNull()
    expect(session.people[1].items).toEqual([])
  })

  it('returns null customShares when no custom shares exist', () => {
    const order = {
      id: 'order-1',
      restaurantId: 'rest-1',
      globalDiscountPercent: 0,
      bankAccountNumber: null,
      createdById: 'user-1',
      status: 'OPEN' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      feeAdjustments: [],
      people: [
        {
          id: 'person-1',
          name: 'Alice',
          sortOrder: 0,
          orderId: 'order-1',
          userId: null,
          items: [
            {
              id: 'item-1',
              name: 'Soup',
              price: 50,
              discountPercent: 15,
              sortOrder: 0,
              personId: 'person-1',
              sharedWith: [],
              customShares: [],
            },
          ],
        },
      ],
    }

    const session = prismaOrderToLunchSession(order)

    expect(session.people[0].items[0].customShares).toBeNull()
    expect(session.people[0].items[0].discountPercent).toBe(15)
  })
})

describe('lunchSessionToPrismaInput', () => {
  it('converts a session with fees and people to Prisma input', () => {
    const session: LunchSession = {
      globalDiscountPercent: 40,
      feeAdjustments: [
        { id: 'fee-1', name: 'Delivery', amount: 49 },
        { id: 'fee-2', name: 'Coupon', amount: -30 },
      ],
      people: [
        {
          id: 'p1',
          name: 'Alice',
          userId: 'user-alice',
          items: [
            {
              id: 'i1',
              name: 'Burger',
              price: 150,
              discountPercent: null,
              sharedWith: ['p2'],
              customShares: { p2: 60 },
            },
          ],
        },
        {
          id: 'p2',
          name: 'Bob',
          userId: null,
          items: [],
        },
      ],
    }

    const input = lunchSessionToPrismaInput(session)

    expect(input.globalDiscountPercent).toBe(40)
    expect(input.feeAdjustments.create).toHaveLength(2)
    expect(input.feeAdjustments.create[0].sortOrder).toBe(0)
    expect(input.feeAdjustments.create[1].sortOrder).toBe(1)
    expect(input.people.create).toHaveLength(2)
    expect(input.people.create[0].sortOrder).toBe(0)
    expect(input.people.create[0].userId).toBe('user-alice')
    expect(input.people.create[0].items.create).toHaveLength(1)
    expect(input.people.create[0].items.create[0].sharedWith.create).toEqual([
      { personId: 'p2' },
    ])
    expect(input.people.create[0].items.create[0].customShares.create).toEqual([
      { personId: 'p2', amount: 60 },
    ])
    expect(input.people.create[1].items.create).toHaveLength(0)
  })

  it('handles empty custom shares as empty array', () => {
    const session: LunchSession = {
      globalDiscountPercent: 0,
      feeAdjustments: [],
      people: [
        {
          id: 'p1',
          name: 'Alice',
          userId: null,
          items: [
            {
              id: 'i1',
              name: 'Salad',
              price: 80,
              discountPercent: 10,
              sharedWith: [],
              customShares: null,
            },
          ],
        },
      ],
    }

    const input = lunchSessionToPrismaInput(session)

    expect(input.people.create[0].items.create[0].customShares.create).toEqual([])
    expect(input.people.create[0].items.create[0].sharedWith.create).toEqual([])
    expect(input.people.create[0].items.create[0].discountPercent).toBe(10)
  })
})
