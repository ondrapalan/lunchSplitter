import type { LunchSession, Person, Item, FeeAdjustment } from '~/features/lunch/types'
import type { Prisma } from '@prisma/client'

/**
 * Full Prisma order with all nested relations included.
 */
type PrismaOrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    feeAdjustments: { orderBy: { sortOrder: 'asc' } }
    people: {
      orderBy: { sortOrder: 'asc' }
      include: {
        items: {
          orderBy: { sortOrder: 'asc' }
          include: {
            sharedWith: true
            customShares: true
          }
        }
      }
    }
  }
}>

/**
 * Converts a Prisma Order (with all relations) to a flat LunchSession.
 */
export function prismaOrderToLunchSession(order: PrismaOrderWithRelations): LunchSession {
  const feeAdjustments: FeeAdjustment[] = order.feeAdjustments.map(f => ({
    id: f.id,
    name: f.name,
    amount: f.amount,
  }))

  const people: Person[] = order.people.map(p => ({
    id: p.id,
    name: p.name,
    userId: p.userId ?? null,
    items: p.items.map(i => {
      const sharedWith = i.sharedWith.map(link => link.personId)
      const customShareEntries = i.customShares.map(cs => [cs.personId, cs.amount] as const)
      const customShares = customShareEntries.length > 0
        ? Object.fromEntries(customShareEntries)
        : null

      return {
        id: i.id,
        name: i.name,
        price: i.price,
        discountPercent: i.discountPercent,
        sharedWith,
        customShares,
      } satisfies Item
    }),
  }))

  return {
    globalDiscountPercent: order.globalDiscountPercent,
    feeAdjustments,
    people,
  }
}

/**
 * Converts a flat LunchSession to Prisma nested create input.
 * Used with the "delete all + recreate" save strategy.
 */
export function lunchSessionToPrismaInput(session: LunchSession) {
  return {
    globalDiscountPercent: session.globalDiscountPercent,
    feeAdjustments: {
      create: session.feeAdjustments.map((f, index) => ({
        id: f.id,
        name: f.name,
        amount: f.amount,
        sortOrder: index,
      })),
    },
    people: {
      create: session.people.map((p, personIndex) => ({
        id: p.id,
        name: p.name,
        sortOrder: personIndex,
        userId: p.userId ?? undefined,
        items: {
          create: p.items.map((item, itemIndex) => ({
            id: item.id,
            name: item.name,
            price: item.price,
            discountPercent: item.discountPercent,
            sortOrder: itemIndex,
            sharedWith: {
              create: item.sharedWith.map(personId => ({
                personId,
              })),
            },
            customShares: {
              create: item.customShares
                ? Object.entries(item.customShares).map(([personId, amount]) => ({
                    personId,
                    amount,
                  }))
                : [],
            },
          })),
        },
      })),
    },
  }
}
