'use server'

import { auth } from '~/lib/auth'
import { prisma } from '~/lib/prisma'

async function getOrderAndAuthorize(orderId: string, personId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      createdById: true,
      status: true,
      people: { select: { id: true, userId: true, _count: { select: { items: true } } } },
    },
  })

  if (!order) throw new Error('Order not found')
  if (order.status !== 'OPEN') throw new Error('Cannot modify a closed order')

  const person = order.people.find(p => p.id === personId)
  if (!person) throw new Error('Person not found in order')

  const isCreator = order.createdById === session.user.id
  const isOwner = person.userId === session.user.id

  if (!isCreator && !isOwner) throw new Error('Unauthorized')

  return { session, order, person, isCreator }
}

async function getCreatorOnly(orderId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      createdById: true,
      status: true,
      people: { select: { id: true, sortOrder: true } },
    },
  })

  if (!order) throw new Error('Order not found')
  if (order.status !== 'OPEN') throw new Error('Cannot modify a closed order')
  if (order.createdById !== session.user.id) throw new Error('Only creator can perform this action')

  return { session, order }
}

export async function addItemToOrder(
  orderId: string,
  personId: string,
  item: { id: string; name: string; price: number; discountPercent: number | null },
) {
  const { person } = await getOrderAndAuthorize(orderId, personId)

  const sortOrder = person._count.items

  const [, orderResult] = await prisma.$transaction([
    prisma.orderItem.create({
      data: {
        id: item.id,
        name: item.name,
        price: item.price,
        discountPercent: item.discountPercent,
        sortOrder,
        personId,
      },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: { updatedAt: new Date() },
      select: { updatedAt: true },
    }),
  ])

  return { success: true, itemId: item.id, updatedAt: orderResult.updatedAt.toISOString() }
}

export async function removeItemFromOrder(
  orderId: string,
  personId: string,
  itemId: string,
) {
  await getOrderAndAuthorize(orderId, personId)

  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    select: { personId: true },
  })
  if (!item || item.personId !== personId) throw new Error('Item not found')

  const [, orderResult] = await prisma.$transaction([
    prisma.orderItem.delete({ where: { id: itemId } }),
    prisma.order.update({
      where: { id: orderId },
      data: { updatedAt: new Date() },
      select: { updatedAt: true },
    }),
  ])

  return { success: true, updatedAt: orderResult.updatedAt.toISOString() }
}

export async function updateItemInOrder(
  orderId: string,
  personId: string,
  itemId: string,
  changes: {
    name?: string
    price?: number
    discountPercent?: number | null
    sharedWith?: string[]
    customShares?: Record<string, number> | null
  },
) {
  const { isCreator, order } = await getOrderAndAuthorize(orderId, personId)

  if (!isCreator && (changes.sharedWith !== undefined || changes.customShares !== undefined)) {
    throw new Error('Participants cannot modify sharing')
  }

  const existingItem = await prisma.orderItem.findUnique({
    where: { id: itemId },
    select: { personId: true },
  })
  if (!existingItem || existingItem.personId !== personId) throw new Error('Item not found')

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const itemUpdate: { name?: string; price?: number; discountPercent?: number | null } = {}
    if (changes.name !== undefined) itemUpdate.name = changes.name
    if (changes.price !== undefined) itemUpdate.price = changes.price
    if ('discountPercent' in changes) itemUpdate.discountPercent = changes.discountPercent

    if (Object.keys(itemUpdate).length > 0) {
      await tx.orderItem.update({ where: { id: itemId }, data: itemUpdate })
    }

    if (changes.sharedWith !== undefined) {
      // Validate all personIds belong to this order
      const validPersonIds = new Set(order.people.map(p => p.id))
      for (const pid of changes.sharedWith) {
        if (!validPersonIds.has(pid)) throw new Error('Invalid personId in sharedWith')
      }

      await tx.sharedItemLink.deleteMany({ where: { itemId } })
      if (changes.sharedWith.length > 0) {
        await tx.sharedItemLink.createMany({
          data: changes.sharedWith.map(pid => ({ itemId, personId: pid })),
        })
      }
    }

    if (changes.customShares !== undefined) {
      // Validate all personIds belong to this order
      const validPersonIds = new Set(order.people.map(p => p.id))
      if (changes.customShares) {
        for (const pid of Object.keys(changes.customShares)) {
          if (!validPersonIds.has(pid)) throw new Error('Invalid personId in customShares')
        }
      }

      await tx.customShare.deleteMany({ where: { itemId } })
      if (changes.customShares) {
        await tx.customShare.createMany({
          data: Object.entries(changes.customShares).map(([pid, amount]) => ({
            itemId,
            personId: pid,
            amount,
          })),
        })
      }
    }

    return tx.order.update({
      where: { id: orderId },
      data: { updatedAt: new Date() },
      select: { updatedAt: true },
    })
  })

  return { success: true, updatedAt: updatedOrder.updatedAt.toISOString() }
}

export async function addPersonToOrder(
  orderId: string,
  personId: string,
  name: string,
  userId?: string,
) {
  const { order } = await getCreatorOnly(orderId)

  const maxSortOrder = order.people.reduce((max, p) => Math.max(max, p.sortOrder), -1)

  const [, orderResult] = await prisma.$transaction([
    prisma.orderPerson.create({
      data: {
        id: personId,
        name,
        sortOrder: maxSortOrder + 1,
        orderId,
        userId: userId ?? undefined,
      },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: { updatedAt: new Date() },
      select: { updatedAt: true },
    }),
  ])

  return { success: true, personId, updatedAt: orderResult.updatedAt.toISOString() }
}

export async function removePersonFromOrder(
  orderId: string,
  personId: string,
) {
  const { order } = await getCreatorOnly(orderId)

  if (!order.people.some(p => p.id === personId)) {
    throw new Error('Person not found in order')
  }

  const updatedOrder = await prisma.$transaction(async (tx) => {
    await tx.sharedItemLink.deleteMany({ where: { personId } })
    await tx.customShare.deleteMany({ where: { personId } })
    await tx.orderPerson.delete({ where: { id: personId } })

    return tx.order.update({
      where: { id: orderId },
      data: { updatedAt: new Date() },
      select: { updatedAt: true },
    })
  })

  return { success: true, updatedAt: updatedOrder.updatedAt.toISOString() }
}

export async function updatePersonInOrder(
  orderId: string,
  personId: string,
  name: string,
) {
  const { order } = await getCreatorOnly(orderId)

  if (!order.people.some(p => p.id === personId)) {
    throw new Error('Person not found in order')
  }

  const [, orderResult] = await prisma.$transaction([
    prisma.orderPerson.update({
      where: { id: personId },
      data: { name },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: { updatedAt: new Date() },
      select: { updatedAt: true },
    }),
  ])

  return { success: true, updatedAt: orderResult.updatedAt.toISOString() }
}
