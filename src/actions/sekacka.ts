'use server'

import { auth } from '~/lib/auth'
import { prisma } from '~/lib/prisma'
import {
  addSekackaParticipant as coreAdd,
  removeSekackaParticipant as coreRemove,
  publishSekackaToDiscordCore,
  SekackaError,
} from '~/lib/sekackaCore'

const SEKACKA_RESTAURANT_NAME = 'Sekačka'

interface CreateSekackaInput {
  items: { name: string; price: number }[]
  bankAccountNumber?: string
}

export async function createSekackaOrder(input: CreateSekackaInput) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const cleanItems = input.items
    .map(i => ({ name: i.name.trim(), price: i.price }))
    .filter(i => i.name.length > 0 && Number.isFinite(i.price) && i.price > 0)

  if (cleanItems.length === 0) {
    throw new Error('Musíš přidat aspoň jednu položku s kladnou cenou')
  }

  let bankAccount = input.bankAccountNumber
  if (!bankAccount) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { bankAccountNumber: true },
    })
    bankAccount = user?.bankAccountNumber ?? undefined
  }

  const restaurant = await prisma.restaurant.upsert({
    where: { name: SEKACKA_RESTAURANT_NAME },
    update: {},
    create: { name: SEKACKA_RESTAURANT_NAME },
  })

  const creatorUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { displayName: true },
  })
  if (!creatorUser) throw new Error('User not found')

  const order = await prisma.order.create({
    data: {
      restaurantId: restaurant.id,
      createdById: session.user.id,
      bankAccountNumber: bankAccount ?? null,
      type: 'SEKACKA',
      people: {
        create: [
          {
            name: creatorUser.displayName,
            userId: session.user.id,
            sortOrder: 0,
            items: {
              create: cleanItems.map((item, idx) => ({
                name: item.name,
                price: item.price,
                sortOrder: idx,
              })),
            },
          },
        ],
      },
      activityLog: {
        create: [
          { action: 'CREATED', actorUserId: session.user.id, source: 'WEB' },
        ],
      },
    },
  })

  return { id: order.id }
}

export async function publishSekackaToDiscord(orderId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { createdById: true, type: true },
  })
  if (!order) throw new Error('Order not found')
  if (order.type !== 'SEKACKA') throw new Error('Not a Sekačka order')

  const isCreator = order.createdById === session.user.id
  const isAdmin = session.user.role === 'ADMIN'
  if (!isCreator && !isAdmin) throw new Error('Unauthorized')

  try {
    const result = await publishSekackaToDiscordCore(orderId)
    return { success: true, ...result }
  } catch (err) {
    if (err instanceof SekackaError) {
      return { success: false, error: err.message }
    }
    throw err
  }
}

export async function addSekackaParticipantByUserId(orderId: string, userId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { createdById: true, type: true },
  })
  if (!order) throw new Error('Order not found')
  if (order.type !== 'SEKACKA') throw new Error('Not a Sekačka order')

  const isCreator = order.createdById === session.user.id
  const isAdmin = session.user.role === 'ADMIN'
  if (!isCreator && !isAdmin) throw new Error('Unauthorized')

  const result = await coreAdd(orderId, userId, { source: 'WEB', actorUserId: session.user.id })
  return result
}

export async function removeSekackaParticipantByUserId(orderId: string, userId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { createdById: true, type: true },
  })
  if (!order) throw new Error('Order not found')
  if (order.type !== 'SEKACKA') throw new Error('Not a Sekačka order')

  const isCreator = order.createdById === session.user.id
  const isAdmin = session.user.role === 'ADMIN'
  if (!isCreator && !isAdmin) throw new Error('Unauthorized')

  const result = await coreRemove(orderId, userId, { source: 'WEB', actorUserId: session.user.id })
  return result
}

export async function getSekackaActivityLog(orderId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { createdById: true, people: { select: { userId: true } } },
  })
  if (!order) throw new Error('Order not found')

  const isCreator = order.createdById === session.user.id
  const isAdmin = session.user.role === 'ADMIN'
  const isParticipant = order.people.some(p => p.userId === session.user.id)
  if (!isCreator && !isAdmin && !isParticipant) throw new Error('Unauthorized')

  const log = await prisma.orderActivityLog.findMany({
    where: { orderId },
    orderBy: { createdAt: 'desc' },
    include: {
      actor: { select: { displayName: true } },
      targetUser: { select: { displayName: true } },
      targetGuest: { select: { name: true } },
    },
  })

  return log.map(entry => ({
    id: entry.id,
    action: entry.action,
    source: entry.source,
    actorName: entry.actor?.displayName ?? null,
    targetName: entry.targetUser?.displayName ?? entry.targetGuest?.name ?? null,
    note: entry.note,
    createdAt: entry.createdAt.toISOString(),
  }))
}

export async function listAppUsersForSekackaPicker(orderId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { createdById: true, type: true, people: { select: { userId: true } } },
  })
  if (!order) throw new Error('Order not found')
  if (order.type !== 'SEKACKA') throw new Error('Not a Sekačka order')

  const isCreator = order.createdById === session.user.id
  const isAdmin = session.user.role === 'ADMIN'
  if (!isCreator && !isAdmin) throw new Error('Unauthorized')

  const existingUserIds = new Set(order.people.map(p => p.userId).filter((id): id is string => !!id))

  const users = await prisma.user.findMany({
    where: { id: { notIn: [...existingUserIds] } },
    select: { id: true, displayName: true, username: true, discordId: true },
    orderBy: { displayName: 'asc' },
  })

  return users
}
