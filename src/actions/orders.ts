'use server'

import { revalidateTag } from 'next/cache'
import { auth } from '~/lib/auth'
import { prisma } from '~/lib/prisma'
import { runHousekeeping } from '~/lib/housekeeping'
import { prismaOrderToLunchSession } from '~/lib/mappers'
import type { Item } from '~/features/lunch/types'
import { getOrderAccess } from '~/lib/orderAccess'
import { calculatePersonSummaries } from '~/features/lunch/utils/calculations'
import { sendOrderQrCodes } from '~/actions/discord'
import { refreshSekackaDiscordMessage } from '~/lib/sekackaCore'
import { cached, ORDER_TAGS, allOrderReadTags } from '~/lib/cache'

function invalidateOrder(orderId: string) {
  revalidateTag(ORDER_TAGS.byId(orderId))
  for (const tag of allOrderReadTags()) revalidateTag(tag)
}

const getItemsByRestaurantCached = cached(
  async (restaurantName: string) => {
    const items = await prisma.orderItem.findMany({
      where: {
        person: {
          order: {
            restaurant: { name: restaurantName },
          },
        },
      },
      select: { name: true, price: true, isPackaging: true },
      orderBy: { person: { order: { createdAt: 'desc' } } },
      take: 500,
    })

    const seen = new Map<string, { name: string; price: number; isPackaging: boolean }>()
    for (const item of items) {
      const key = item.name.toLowerCase()
      if (!seen.has(key)) {
        seen.set(key, { name: item.name, price: item.price, isPackaging: item.isPackaging })
      }
    }
    return [...seen.values()]
  },
  ['items-by-restaurant'],
  (name) => ({ tags: [ORDER_TAGS.itemsByRestaurant(name), ORDER_TAGS.itemsAll], revalidate: 300 }),
)

const getRestaurantNamesCached = cached(
  async () => {
    const restaurants = await prisma.restaurant.findMany({
      select: { name: true },
      orderBy: { name: 'asc' },
    })
    return restaurants.map(r => r.name)
  },
  ['restaurant-names'],
  { tags: [ORDER_TAGS.restaurantNames], revalidate: 300 },
)

export async function getItemsByRestaurant(restaurantName: string): Promise<{ name: string; price: number; isPackaging: boolean }[]> {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  return getItemsByRestaurantCached(restaurantName)
}

export async function getRestaurantNames() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  return getRestaurantNamesCached()
}

const DEFAULT_FEE_NAMES = ['Delivery', 'Delivery coupon', 'Service'] as const

export async function createOrder(restaurantName: string, bankAccountNumber?: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  // Use provided bankAccountNumber, fallback to user's saved one
  let bankAccount = bankAccountNumber
  if (!bankAccount) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { bankAccountNumber: true },
    })
    bankAccount = user?.bankAccountNumber ?? undefined
  }

  const restaurant = await prisma.restaurant.upsert({
    where: { name: restaurantName },
    update: {},
    create: { name: restaurantName },
  })

  const order = await prisma.order.create({
    data: {
      restaurantId: restaurant.id,
      createdById: session.user.id,
      bankAccountNumber: bankAccount ?? null,
      feeAdjustments: {
        create: DEFAULT_FEE_NAMES.map((name, sortOrder) => ({
          name,
          amount: 0,
          sortOrder,
        })),
      },
    },
  })

  revalidateTag(ORDER_TAGS.open)
  revalidateTag(ORDER_TAGS.restaurantNames)
  return { id: order.id }
}

export async function deleteOrder(orderId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { createdById: true },
  })
  if (!order) throw new Error('Order not found')
  const isCreator = order.createdById === session.user.id
  const isAdmin = session.user.role === 'ADMIN'
  if (!isCreator && !isAdmin) {
    throw new Error('Unauthorized')
  }

  // Cascade deletes handle children
  await prisma.order.delete({ where: { id: orderId } })

  invalidateOrder(orderId)
  return { success: true }
}

export async function getOrder(orderId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      restaurant: true,
      createdBy: { select: { displayName: true, bankAccountNumber: true } },
      feeAdjustments: { orderBy: { sortOrder: 'asc' } },
      people: {
        orderBy: { sortOrder: 'asc' },
        include: {
          user: { select: { displayName: true } },
          guest: { select: { name: true } },
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

  const access = getOrderAccess(
    { createdById: order.createdById, status: order.status as 'OPEN' | 'CLOSED', people: order.people },
    { id: session.user.id, role: session.user.role },
  )

  if (!access.canView) {
    return null
  }

  const currentUserPerson = order.people.find(p => p.userId === session.user.id)

  return {
    restaurantName: order.restaurant.name,
    session: prismaOrderToLunchSession(order),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    creatorName: order.createdBy.displayName,
    status: order.status as 'OPEN' | 'CLOSED',
    type: order.type as 'NORMAL' | 'SEKACKA',
    discordAnnounceMessageId: order.discordAnnounceMessageId,
    bankAccountNumber: order.bankAccountNumber,
    creatorBankAccount: order.createdBy.bankAccountNumber,
    createdById: order.createdById,
    access: {
      ...access,
      currentUserPersonId: currentUserPerson?.id ?? null,
    },
  }
}

export async function listOrders() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const orders = await prisma.order.findMany({
    where: {
      status: 'CLOSED',
      OR: [
        { createdById: session.user.id },
        { people: { some: { userId: session.user.id } } },
      ],
    },
    include: {
      restaurant: true,
      createdBy: { select: { displayName: true } },
      _count: { select: { people: true } },
      feeAdjustments: { orderBy: { sortOrder: 'asc' } },
      people: {
        orderBy: { sortOrder: 'asc' },
        include: {
          user: { select: { displayName: true } },
          guest: { select: { name: true } },
          paymentConfirmation: { select: { confirmedVia: true } },
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
    orderBy: { updatedAt: 'desc' },
  })

  return orders.map(order => {
    const isCreator = order.createdById === session.user.id
    let bankAccountNumber: string | null = null
    let myPersonId: string | null = null
    let myAmount: number | null = null
    let paymentStatus: { paid: number; total: number } | null = null

    if (!isCreator && order.bankAccountNumber) {
      const lunchSession = prismaOrderToLunchSession(order)
      const summaries = calculatePersonSummaries(lunchSession)
      const myPerson = order.people.find(p => p.userId === session.user.id)
      if (myPerson) {
        const mySummary = summaries.find(s => s.personId === myPerson.id)
        if (mySummary && mySummary.withFees > 0) {
          bankAccountNumber = order.bankAccountNumber
          myPersonId = myPerson.id
          myAmount = mySummary.withFees
        }
      }
    }

    // For creator's orders: count how many participants (excluding creator) have confirmed payment
    if (isCreator) {
      const creatorPersonId = order.people.find(p => p.userId === order.createdById)?.id
      const participants = order.people.filter(p => p.id !== creatorPersonId)
      const paid = participants.filter(p =>
        p.paymentConfirmation && p.paymentConfirmation.confirmedVia !== 'pending'
      ).length
      paymentStatus = { paid, total: participants.length }
    }

    return {
      id: order.id,
      restaurantName: order.restaurant.name,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      isCreator,
      creatorName: order.createdBy.displayName,
      peopleCount: order._count.people,
      bankAccountNumber,
      myPersonId,
      myAmount,
      paymentStatus,
    }
  })
}

export async function listAdminOrders() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  if (session.user.role !== 'ADMIN') throw new Error('Admin only')

  const orders = await prisma.order.findMany({
    where: {
      status: 'CLOSED',
      NOT: {
        OR: [
          { createdById: session.user.id },
          { people: { some: { userId: session.user.id } } },
        ],
      },
    },
    include: {
      restaurant: true,
      createdBy: { select: { displayName: true } },
      _count: { select: { people: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return orders.map(order => ({
    id: order.id,
    restaurantName: order.restaurant.name,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    isCreator: false,
    creatorName: order.createdBy.displayName,
    peopleCount: order._count.people,
  }))
}

export async function closeOrder(orderId: string, options?: { sendDiscord?: boolean }) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { createdById: true, type: true },
  })
  if (!order) throw new Error('Order not found')
  const isCreator = order.createdById === session.user.id
  const isAdmin = session.user.role === 'ADMIN'
  if (!isCreator && !isAdmin) {
    throw new Error('Unauthorized')
  }

  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { status: 'CLOSED' },
    }),
    prisma.orderActivityLog.create({
      data: {
        orderId,
        action: 'CLOSED',
        actorUserId: session.user.id,
        source: 'WEB',
      },
    }),
  ])

  const sendDiscord = options?.sendDiscord ?? true
  const discordResult = sendDiscord
    ? await sendOrderQrCodes(orderId).catch(() => null)
    : null

  if (order.type === 'SEKACKA') {
    await refreshSekackaDiscordMessage(orderId).catch(err => {
      console.error('Failed to refresh closed Sekačka message:', err)
    })
  }

  invalidateOrder(orderId)
  return { success: true, discord: discordResult }
}

interface CloseOrderDraft {
  globalDiscountPercent: number
  feeAdjustments: { id: string; name: string; amount: number }[]
  bankAccountNumber: string | null
}

export async function closeOrderWithDraft(
  orderId: string,
  draft: CloseOrderDraft,
  options?: { sendDiscord?: boolean; expectedUpdatedAt?: string },
) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { createdById: true, type: true, status: true, updatedAt: true },
  })
  if (!order) throw new Error('Order not found')
  const isCreator = order.createdById === session.user.id
  const isAdmin = session.user.role === 'ADMIN'
  if (!isCreator && !isAdmin) {
    throw new Error('Unauthorized')
  }
  if (order.status === 'CLOSED') {
    throw new Error('Order is already closed')
  }
  if (options?.expectedUpdatedAt && order.updatedAt.toISOString() !== options.expectedUpdatedAt) {
    throw new Error('Order was modified by someone else. Please refresh and try again.')
  }

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.order.findUnique({ where: { id: orderId }, select: { status: true } })
    if (fresh?.status === 'CLOSED') throw new Error('Order is already closed')

    await tx.feeAdjustment.deleteMany({ where: { orderId } })
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'CLOSED',
        globalDiscountPercent: draft.globalDiscountPercent,
        bankAccountNumber: draft.bankAccountNumber,
        feeAdjustments: {
          create: draft.feeAdjustments.map((f, sortOrder) => ({
            id: f.id,
            name: f.name,
            amount: f.amount,
            sortOrder,
          })),
        },
      },
    })
    await tx.orderActivityLog.create({
      data: {
        orderId,
        action: 'CLOSED',
        actorUserId: session.user.id,
        source: 'WEB',
      },
    })
  }, { timeout: 20_000 })

  const sendDiscord = options?.sendDiscord ?? true
  const discordResult = sendDiscord
    ? await sendOrderQrCodes(orderId).catch(() => null)
    : null

  if (order.type === 'SEKACKA') {
    await refreshSekackaDiscordMessage(orderId).catch(err => {
      console.error('Failed to refresh closed Sekačka message:', err)
    })
  }

  invalidateOrder(orderId)
  return { success: true, discord: discordResult }
}

export async function reopenOrder(orderId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { createdById: true, type: true },
  })
  if (!order) throw new Error('Order not found')
  const isCreator = order.createdById === session.user.id
  const isAdmin = session.user.role === 'ADMIN'
  if (!isCreator && !isAdmin) {
    throw new Error('Unauthorized')
  }

  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { status: 'OPEN' },
    }),
    prisma.orderActivityLog.create({
      data: {
        orderId,
        action: 'REOPENED',
        actorUserId: session.user.id,
        source: 'WEB',
      },
    }),
  ])

  if (order.type === 'SEKACKA') {
    await refreshSekackaDiscordMessage(orderId).catch(err => {
      console.error('Failed to refresh reopened Sekačka message:', err)
    })
  }

  invalidateOrder(orderId)
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

  invalidateOrder(orderId)
  return result
}

export async function leaveOrder(orderId: string) {
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
  if (order.createdById === session.user.id) throw new Error('Creator cannot leave their own order')

  const person = order.people.find(p => p.userId === session.user.id)
  if (!person) throw new Error('You are not a participant')

  await prisma.$transaction(async (tx) => {
    // Prisma onDelete: Cascade handles OrderItem, SharedItemLink, CustomShare cleanup
    await tx.orderPerson.delete({ where: { id: person.id } })
    await tx.order.update({
      where: { id: orderId },
      data: { updatedAt: new Date() },
    })
  })

  invalidateOrder(orderId)
  return { success: true }
}

export async function listOpenOrders() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  void runHousekeeping()

  const orders = await prisma.order.findMany({
    where: { status: 'OPEN' },
    include: {
      restaurant: true,
      createdBy: { select: { displayName: true } },
      people: { select: { userId: true } },
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
    throw new Error('Creator should not use saveMyItems; edits go through the per-item actions')
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

  invalidateOrder(orderId)
  revalidateTag(ORDER_TAGS.itemsAll)
  return { success: true }
}
