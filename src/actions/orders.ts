'use server'

import { auth } from '~/lib/auth'
import { prisma } from '~/lib/prisma'
import { prismaOrderToLunchSession, lunchSessionToPrismaInput } from '~/lib/mappers'
import type { LunchSession, Item } from '~/features/lunch/types'

export async function getItemsByRestaurant(restaurantName: string): Promise<{ name: string; price: number }[]> {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const items = await prisma.orderItem.findMany({
    where: {
      person: {
        order: {
          restaurant: { name: restaurantName },
        },
      },
    },
    select: { name: true, price: true },
    orderBy: { person: { order: { createdAt: 'desc' } } },
  })

  const seen = new Map<string, { name: string; price: number }>()
  for (const item of items) {
    const key = item.name.toLowerCase()
    if (!seen.has(key)) {
      seen.set(key, { name: item.name, price: item.price })
    }
  }

  return [...seen.values()]
}

export async function getRestaurantNames() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const restaurants = await prisma.restaurant.findMany({
    select: { name: true },
    orderBy: { name: 'asc' },
  })

  return restaurants.map(r => r.name)
}

export async function createOrder(restaurantName: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const restaurant = await prisma.restaurant.upsert({
    where: { name: restaurantName.toLowerCase() },
    update: { name: restaurantName },
    create: { name: restaurantName },
  })

  const order = await prisma.order.create({
    data: {
      restaurantId: restaurant.id,
      createdById: session.user.id,
    },
  })

  return { id: order.id }
}

export async function saveOrder(orderId: string, lunchSession: LunchSession) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { createdById: true },
  })
  if (!order || order.createdById !== session.user.id) {
    throw new Error('Unauthorized')
  }

  const input = lunchSessionToPrismaInput(lunchSession)

  // Delete all children, then recreate from current client state
  await prisma.$transaction([
    prisma.customShare.deleteMany({ where: { item: { person: { orderId } } } }),
    prisma.sharedItemLink.deleteMany({ where: { item: { person: { orderId } } } }),
    prisma.orderItem.deleteMany({ where: { person: { orderId } } }),
    prisma.orderPerson.deleteMany({ where: { orderId } }),
    prisma.feeAdjustment.deleteMany({ where: { orderId } }),
    prisma.order.update({
      where: { id: orderId },
      data: {
        globalDiscountPercent: input.globalDiscountPercent,
        feeAdjustments: input.feeAdjustments,
        people: input.people,
      },
    }),
  ])

  return { success: true }
}

export async function deleteOrder(orderId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { createdById: true },
  })
  if (!order || order.createdById !== session.user.id) {
    throw new Error('Unauthorized')
  }

  // Cascade deletes handle children
  await prisma.order.delete({ where: { id: orderId } })

  return { success: true }
}

export async function getOrder(orderId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      restaurant: true,
      createdBy: { select: { displayName: true } },
      feeAdjustments: { orderBy: { sortOrder: 'asc' } },
      people: {
        orderBy: { sortOrder: 'asc' },
        include: {
          items: {
            orderBy: { sortOrder: 'asc' },
            include: {
              sharedWith: true,
              customShares: true,
            },
          },
        },
      },
    },
  })

  if (!order) return null

  return {
    restaurantName: order.restaurant.name,
    session: prismaOrderToLunchSession(order),
    isCreator: order.createdById === session.user.id,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    creatorName: order.createdBy.displayName,
  }
}

export async function listOrders() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { createdById: session.user.id },
        { people: { some: { userId: session.user.id } } },
      ],
    },
    include: {
      restaurant: true,
      createdBy: { select: { displayName: true } },
      _count: { select: { people: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return orders.map(order => ({
    id: order.id,
    restaurantName: order.restaurant.name,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    isCreator: order.createdById === session.user.id,
    creatorName: order.createdBy.displayName,
    peopleCount: order._count.people,
  }))
}

export async function closeOrder(orderId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { createdById: true },
  })
  if (!order || order.createdById !== session.user.id) {
    throw new Error('Unauthorized')
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'CLOSED' },
  })

  return { success: true }
}

export async function reopenOrder(orderId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { createdById: true },
  })
  if (!order || order.createdById !== session.user.id) {
    throw new Error('Unauthorized')
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'OPEN' },
  })

  return { success: true }
}

export async function joinOrder(orderId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      people: { select: { userId: true, sortOrder: true } },
    },
  })

  if (!order) throw new Error('Order not found')
  if (order.status !== 'OPEN') throw new Error('Order is closed')
  if (order.createdById === session.user.id) throw new Error('Creator cannot join as participant')
  if (order.people.some(p => p.userId === session.user.id)) {
    throw new Error('Already a participant')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { displayName: true },
  })
  if (!user) throw new Error('User not found')

  const maxSortOrder = order.people.reduce((max, p) => Math.max(max, p.sortOrder), -1)

  const result = await prisma.$transaction(async (tx) => {
    const person = await tx.orderPerson.create({
      data: {
        name: user.displayName,
        userId: session.user.id,
        orderId,
        sortOrder: maxSortOrder + 1,
      },
    })

    await tx.order.update({
      where: { id: orderId },
      data: { updatedAt: new Date() },
    })

    return { personId: person.id }
  })

  return result
}

export async function listOpenOrders() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const orders = await prisma.order.findMany({
    where: { status: 'OPEN' },
    include: {
      restaurant: true,
      createdBy: { select: { displayName: true } },
      people: { select: { userId: true } },
      _count: { select: { people: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return orders.map(order => ({
    id: order.id,
    restaurantName: order.restaurant.name,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    isCreator: order.createdById === session.user.id,
    creatorName: order.createdBy.displayName,
    peopleCount: order._count.people,
    isParticipant: order.people.some(p => p.userId === session.user.id),
  }))
}

export async function saveMyItems(
  orderId: string,
  personId: string,
  items: Item[],
  expectedUpdatedAt: string,
) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      people: { select: { id: true, userId: true } },
    },
  })

  if (!order) throw new Error('Order not found')
  if (order.status !== 'OPEN') throw new Error('Order is closed')
  if (order.createdById === session.user.id) {
    throw new Error('Creator should use saveOrder instead')
  }

  const person = order.people.find(p => p.id === personId)
  if (!person || person.userId !== session.user.id) {
    throw new Error('Person does not belong to current user')
  }

  // Optimistic lock: reject if order was modified since client last fetched
  if (order.updatedAt.toISOString() !== expectedUpdatedAt) {
    throw new Error('Order was modified by someone else. Please refresh and try again.')
  }

  // Validate: participant items must not have sharedWith or customShares
  for (const item of items) {
    if (item.sharedWith.length > 0) {
      throw new Error('Participant items cannot have sharedWith')
    }
    if (item.customShares !== null) {
      throw new Error('Participant items cannot have customShares')
    }
  }

  await prisma.$transaction(async (tx) => {
    // Delete existing items for this person
    await tx.orderItem.deleteMany({ where: { personId } })

    // Create new items
    if (items.length > 0) {
      await tx.orderItem.createMany({
        data: items.map((item, index) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          discountPercent: item.discountPercent,
          sortOrder: index,
          personId,
        })),
      })
    }

    // Bump order.updatedAt
    await tx.order.update({
      where: { id: orderId },
      data: { updatedAt: new Date() },
    })
  })

  return { success: true }
}
