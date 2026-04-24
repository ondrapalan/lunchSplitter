import 'server-only'
import { prisma } from '~/lib/prisma'
import { sendChannelMessage, editChannelMessage, sendPendingLinkDm, isDiscordConfigured } from '~/lib/discord'
import { buildSekackaMessage } from '~/features/lunch/utils/sekackaDiscordMessage'
import type { ActivitySource, OrderActivityAction } from '@prisma/client'

export class SekackaError extends Error {
  constructor(public code: 'NOT_FOUND' | 'NOT_SEKACKA' | 'CLOSED' | 'ALREADY_PARTICIPANT' | 'NOT_PARTICIPANT' | 'CONFIG' | 'FORBIDDEN', message: string) {
    super(message)
    this.name = 'SekackaError'
  }
}

export interface ActivityContext {
  source: ActivitySource
  actorUserId: string | null
}

function buildPublicAdminUrl(): string {
  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, '') ?? ''
  return `${base}/admin/discord-links`
}

/**
 * Full-order read helper used to build the Discord embed.
 */
async function loadSekackaForEmbed(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      createdBy: { select: { displayName: true, id: true } },
      people: {
        orderBy: { sortOrder: 'asc' },
        include: {
          user: { select: { displayName: true } },
          guest: { select: { name: true } },
          items: { orderBy: { sortOrder: 'asc' } },
        },
      },
    },
  })
  if (!order) throw new SekackaError('NOT_FOUND', 'Order not found')
  if (order.type !== 'SEKACKA') throw new SekackaError('NOT_SEKACKA', 'Not a Sekačka order')
  return order
}

export async function refreshSekackaDiscordMessage(orderId: string): Promise<void> {
  const order = await loadSekackaForEmbed(orderId)
  if (!order.discordAnnounceChannelId || !order.discordAnnounceMessageId) return
  if (!isDiscordConfigured()) return

  const creatorPerson = order.people.find(p => p.userId === order.createdById)
  const items = creatorPerson?.items.map(i => ({ name: i.name, price: i.price })) ?? []
  const participantNames = order.people.map(p => p.user?.displayName ?? p.guest?.name ?? p.name)

  const payload = buildSekackaMessage({
    orderId: order.id,
    items,
    participantNames,
    creatorName: order.createdBy.displayName,
    status: order.status as 'OPEN' | 'CLOSED',
  })

  try {
    await editChannelMessage(order.discordAnnounceChannelId, order.discordAnnounceMessageId, payload)
  } catch (err) {
    console.error('Failed to refresh Sekačka Discord message:', err)
  }
}

export async function publishSekackaToDiscordCore(orderId: string): Promise<{ channelId: string; messageId: string }> {
  const channelId = process.env.DISCORD_OBEDY_CHANNEL_ID
  if (!channelId) {
    throw new SekackaError('CONFIG', 'DISCORD_OBEDY_CHANNEL_ID is not configured')
  }
  if (!isDiscordConfigured()) {
    throw new SekackaError('CONFIG', 'Discord bot is not fully configured')
  }

  const order = await loadSekackaForEmbed(orderId)
  if (order.discordAnnounceMessageId) {
    throw new SekackaError('CONFIG', 'Sekačka is already published to Discord')
  }

  const creatorPerson = order.people.find(p => p.userId === order.createdById)
  const items = creatorPerson?.items.map(i => ({ name: i.name, price: i.price })) ?? []
  const participantNames = order.people.map(p => p.user?.displayName ?? p.guest?.name ?? p.name)

  const payload = buildSekackaMessage({
    orderId: order.id,
    items,
    participantNames,
    creatorName: order.createdBy.displayName,
    status: order.status as 'OPEN' | 'CLOSED',
  })

  const message = await sendChannelMessage(channelId, payload)

  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: {
        discordAnnounceChannelId: channelId,
        discordAnnounceMessageId: message.id,
      },
    }),
    prisma.orderActivityLog.create({
      data: {
        orderId,
        action: 'PUBLISHED_TO_DISCORD',
        actorUserId: order.createdById,
        source: 'WEB',
      },
    }),
  ])

  return { channelId, messageId: message.id }
}

async function nextSortOrder(orderId: string): Promise<number> {
  const max = await prisma.orderPerson.aggregate({
    where: { orderId },
    _max: { sortOrder: true },
  })
  return (max._max.sortOrder ?? -1) + 1
}

/**
 * Add a registered user as a participant on a Sekačka order. Also `SharedItemLink`s
 * that person onto every creator-owned OrderItem so the existing split algorithm
 * divides evenly.
 *
 * Idempotent: if the user is already a participant, resolves with `added=false`.
 */
export async function addSekackaParticipant(
  orderId: string,
  userId: string,
  ctx: ActivityContext,
): Promise<{ added: boolean; personId: string }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      type: true,
      status: true,
      createdById: true,
      people: { select: { id: true, userId: true } },
      discordAnnounceMessageId: true,
      discordAnnounceChannelId: true,
    },
  })
  if (!order) throw new SekackaError('NOT_FOUND', 'Order not found')
  if (order.type !== 'SEKACKA') throw new SekackaError('NOT_SEKACKA', 'Not a Sekačka order')
  if (order.status !== 'OPEN') throw new SekackaError('CLOSED', 'Sekačka is already closed')

  const existing = order.people.find(p => p.userId === userId)
  if (existing) return { added: false, personId: existing.id }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true },
  })
  if (!user) throw new SekackaError('NOT_FOUND', 'User not found')

  const creatorPerson = order.people.find(p => p.userId === order.createdById)
  if (!creatorPerson) {
    throw new SekackaError('NOT_FOUND', 'Sekačka has no creator participant (unexpected)')
  }

  const sortOrder = await nextSortOrder(orderId)

  const person = await prisma.$transaction(async (tx) => {
    const created = await tx.orderPerson.create({
      data: {
        name: user.displayName,
        userId,
        orderId,
        sortOrder,
      },
    })

    const creatorItems = await tx.orderItem.findMany({
      where: { personId: creatorPerson.id },
      select: { id: true },
    })
    if (creatorItems.length > 0) {
      await tx.sharedItemLink.createMany({
        data: creatorItems.map(it => ({ itemId: it.id, personId: created.id })),
        skipDuplicates: true,
      })
    }

    await tx.orderActivityLog.create({
      data: {
        orderId,
        action: (ctx.source === 'DISCORD' ? 'JOINED' : 'MANUAL_ADDED') as OrderActivityAction,
        actorUserId: ctx.actorUserId ?? userId,
        targetUserId: userId,
        source: ctx.source,
      },
    })

    await tx.order.update({
      where: { id: orderId },
      data: { updatedAt: new Date() },
    })

    return created
  })

  await refreshSekackaDiscordMessage(orderId)

  return { added: true, personId: person.id }
}

/**
 * Remove a participant (not the creator) from a Sekačka order. Cascades via Prisma
 * clean up OrderItem / SharedItemLink / PaymentConfirmation.
 *
 * Idempotent: if not a participant, resolves with `removed=false`.
 */
export async function removeSekackaParticipant(
  orderId: string,
  userId: string,
  ctx: ActivityContext,
): Promise<{ removed: boolean }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      type: true,
      status: true,
      createdById: true,
      people: { select: { id: true, userId: true } },
    },
  })
  if (!order) throw new SekackaError('NOT_FOUND', 'Order not found')
  if (order.type !== 'SEKACKA') throw new SekackaError('NOT_SEKACKA', 'Not a Sekačka order')
  if (order.status !== 'OPEN') throw new SekackaError('CLOSED', 'Sekačka is already closed')

  if (order.createdById === userId) {
    throw new SekackaError('FORBIDDEN', "The creator can't leave their own Sekačka")
  }

  const person = order.people.find(p => p.userId === userId)
  if (!person) return { removed: false }

  await prisma.$transaction(async (tx) => {
    await tx.orderPerson.delete({ where: { id: person.id } })
    await tx.orderActivityLog.create({
      data: {
        orderId,
        action: (ctx.source === 'DISCORD' ? 'LEFT' : 'MANUAL_REMOVED') as OrderActivityAction,
        actorUserId: ctx.actorUserId ?? userId,
        targetUserId: userId,
        source: ctx.source,
      },
    })
    await tx.order.update({
      where: { id: orderId },
      data: { updatedAt: new Date() },
    })
  })

  await refreshSekackaDiscordMessage(orderId)

  return { removed: true }
}

/**
 * Record that an unlinked Discord user clicked Popiči. Creates/updates a
 * PendingDiscordLink row and DMs admins.
 */
export async function recordPendingDiscordLink(
  orderId: string,
  discord: { id: string; username: string; globalName: string | null; nick: string | null },
): Promise<void> {
  const existing = await prisma.pendingDiscordLink.findUnique({ where: { discordId: discord.id } })

  const pendingLink = await prisma.pendingDiscordLink.upsert({
    where: { discordId: discord.id },
    create: {
      discordId: discord.id,
      discordUsername: discord.username,
      discordGlobalName: discord.globalName,
      discordNick: discord.nick,
      triggeredByOrderId: orderId,
    },
    update: {
      discordUsername: discord.username,
      discordGlobalName: discord.globalName,
      discordNick: discord.nick,
      triggeredByOrderId: orderId,
      resolvedAt: null,
      resolvedByUserId: null,
    },
  })

  await prisma.orderActivityLog.create({
    data: {
      orderId,
      action: 'PENDING_LINK_CREATED',
      source: 'DISCORD',
      note: `${discord.globalName ?? discord.username} (@${discord.username})`,
    },
  })

  // Only DM admins the first time we see this Discord id — avoid nagging on repeat clicks.
  if (existing && !existing.resolvedAt) return

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', discordId: { not: null } },
    select: { discordId: true },
  })

  if (!isDiscordConfigured() || admins.length === 0) return

  const adminPageUrl = buildPublicAdminUrl()
  const displayName = discord.nick ?? discord.globalName ?? discord.username

  await Promise.all(
    admins.map(async admin => {
      if (!admin.discordId) return
      try {
        await sendPendingLinkDm(admin.discordId, {
          pendingLinkId: pendingLink.id,
          discordDisplayName: displayName,
          discordUsername: discord.username,
          orderId,
          adminPageUrl,
        })
      } catch (err) {
        console.error('Failed to DM admin about pending link:', err)
      }
    }),
  )
}
