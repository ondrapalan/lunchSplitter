'use server'

import { auth } from '~/lib/auth'
import { prisma } from '~/lib/prisma'

export interface GuestSuggestion {
  id: string
  name: string
  aliases: string[]
  defaultHostUserId: string
  defaultHostDisplayName: string
}

export async function listGuests(): Promise<GuestSuggestion[]> {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const guests = await prisma.guest.findMany({
    select: {
      id: true,
      name: true,
      aliases: true,
      defaultHostUserId: true,
      defaultHost: { select: { displayName: true } },
    },
    orderBy: { name: 'asc' },
  })

  return guests.map(g => ({
    id: g.id,
    name: g.name,
    aliases: g.aliases,
    defaultHostUserId: g.defaultHostUserId,
    defaultHostDisplayName: g.defaultHost.displayName,
  }))
}

export async function listGuestsWithStats() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const guests = await prisma.guest.findMany({
    select: {
      id: true,
      name: true,
      aliases: true,
      defaultHostUserId: true,
      defaultHost: { select: { displayName: true } },
      orderPersons: {
        select: {
          id: true,
          hostUserId: true,
          order: { select: { createdAt: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  return guests.map(g => {
    const visitCount = g.orderPersons.length
    const lastVisit = g.orderPersons.reduce<Date | null>((latest, op) => {
      const d = op.order.createdAt
      return !latest || d > latest ? d : latest
    }, null)
    return {
      id: g.id,
      name: g.name,
      aliases: g.aliases,
      defaultHostUserId: g.defaultHostUserId,
      defaultHostDisplayName: g.defaultHost.displayName,
      visitCount,
      lastVisit: lastVisit?.toISOString() ?? null,
    }
  })
}

export async function createGuest(input: { name: string; defaultHostUserId: string; aliases?: string[] }) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const name = input.name.trim()
  if (!name) throw new Error('Guest name is required')

  const host = await prisma.user.findUnique({ where: { id: input.defaultHostUserId }, select: { id: true } })
  if (!host) throw new Error('Default host not found')

  const aliases = (input.aliases ?? []).map(a => a.trim()).filter(Boolean)

  const guest = await prisma.guest.create({
    data: {
      name,
      defaultHostUserId: input.defaultHostUserId,
      aliases,
    },
    select: {
      id: true,
      name: true,
      aliases: true,
      defaultHostUserId: true,
      defaultHost: { select: { displayName: true } },
    },
  })

  return {
    id: guest.id,
    name: guest.name,
    aliases: guest.aliases,
    defaultHostUserId: guest.defaultHostUserId,
    defaultHostDisplayName: guest.defaultHost.displayName,
  } satisfies GuestSuggestion
}

export async function updateGuest(id: string, input: { name?: string; defaultHostUserId?: string; aliases?: string[] }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    throw new Error('Admin only')
  }

  const data: { name?: string; defaultHostUserId?: string; aliases?: string[] } = {}
  if (input.name !== undefined) {
    const trimmed = input.name.trim()
    if (!trimmed) throw new Error('Name cannot be empty')
    data.name = trimmed
  }
  if (input.defaultHostUserId !== undefined) {
    const host = await prisma.user.findUnique({ where: { id: input.defaultHostUserId }, select: { id: true } })
    if (!host) throw new Error('Default host not found')
    data.defaultHostUserId = input.defaultHostUserId
  }
  if (input.aliases !== undefined) {
    data.aliases = input.aliases.map(a => a.trim()).filter(Boolean)
  }

  await prisma.guest.update({ where: { id }, data })
  return { success: true }
}

export async function deleteGuest(id: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    throw new Error('Admin only')
  }

  const visits = await prisma.orderPerson.count({ where: { guestId: id } })
  if (visits > 0) {
    throw new Error(`Cannot delete guest with ${visits} order appearance(s). Remove them from orders first.`)
  }

  await prisma.guest.delete({ where: { id } })
  return { success: true }
}

export async function listLegacyGuestNames() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    throw new Error('Admin only')
  }

  const legacy = await prisma.orderPerson.findMany({
    where: { userId: null, guestId: null },
    select: {
      name: true,
      orderId: true,
      order: { select: { createdAt: true } },
    },
  })

  const byName = new Map<string, { name: string; count: number; lastSeen: Date }>()
  for (const row of legacy) {
    const key = row.name.trim()
    if (!key) continue
    const entry = byName.get(key)
    if (!entry) {
      byName.set(key, { name: key, count: 1, lastSeen: row.order.createdAt })
    } else {
      entry.count += 1
      if (row.order.createdAt > entry.lastSeen) entry.lastSeen = row.order.createdAt
    }
  }

  return [...byName.values()]
    .sort((a, b) => b.count - a.count)
    .map(e => ({ name: e.name, count: e.count, lastSeen: e.lastSeen.toISOString() }))
}

export async function backfillLegacyGuest(input: {
  legacyName: string
  guestId: string
  hostUserId: string
}) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    throw new Error('Admin only')
  }

  const trimmed = input.legacyName.trim()
  if (!trimmed) throw new Error('legacyName is required')

  const [guest, host] = await Promise.all([
    prisma.guest.findUnique({ where: { id: input.guestId }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: input.hostUserId }, select: { id: true } }),
  ])
  if (!guest) throw new Error('Guest not found')
  if (!host) throw new Error('Host not found')

  const result = await prisma.orderPerson.updateMany({
    where: { userId: null, guestId: null, name: trimmed },
    data: { guestId: input.guestId, hostUserId: input.hostUserId },
  })

  return { updated: result.count }
}
