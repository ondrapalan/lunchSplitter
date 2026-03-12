'use server'

import { auth } from '~/lib/auth'
import { prisma } from '~/lib/prisma'
import { prismaOrderToLunchSession, lunchSessionToPrismaInput } from '~/lib/mappers'
import type { LunchSession } from '~/features/lunch/types'

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
    where: { createdById: session.user.id },
    include: {
      restaurant: true,
      _count: { select: { people: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return orders.map(order => ({
    id: order.id,
    restaurantName: order.restaurant.name,
    createdAt: order.createdAt.toISOString(),
    peopleCount: order._count.people,
  }))
}
