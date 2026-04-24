'use server'

import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { auth } from '~/lib/auth'
import { prisma } from '~/lib/prisma'
import { addSekackaParticipant } from '~/lib/sekackaCore'

const BCRYPT_ROUNDS = 12

async function requireAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    throw new Error('Unauthorized')
  }
  return session.user
}

export async function listPendingDiscordLinks() {
  await requireAdmin()

  const links = await prisma.pendingDiscordLink.findMany({
    where: { resolvedAt: null },
    orderBy: { createdAt: 'desc' },
    include: {
      triggeredByOrder: {
        select: {
          id: true,
          status: true,
          type: true,
          createdBy: { select: { displayName: true } },
        },
      },
    },
  })

  return links.map(l => ({
    id: l.id,
    discordId: l.discordId,
    discordUsername: l.discordUsername,
    discordGlobalName: l.discordGlobalName,
    discordNick: l.discordNick,
    createdAt: l.createdAt.toISOString(),
    triggeredByOrder: l.triggeredByOrder
      ? {
          id: l.triggeredByOrder.id,
          status: l.triggeredByOrder.status,
          type: l.triggeredByOrder.type,
          creatorName: l.triggeredByOrder.createdBy.displayName,
        }
      : null,
  }))
}

export async function getPendingDiscordLinkCount() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') return 0
  return prisma.pendingDiscordLink.count({ where: { resolvedAt: null } })
}

async function finalizeResolution(pendingLinkId: string, resolverUserId: string, linkedUserId: string) {
  const link = await prisma.pendingDiscordLink.update({
    where: { id: pendingLinkId },
    data: {
      resolvedAt: new Date(),
      resolvedByUserId: resolverUserId,
    },
    include: {
      triggeredByOrder: { select: { id: true, type: true, status: true } },
    },
  })

  // Auto-add the newly-linked user to the Sekačka that triggered this pending link,
  // but only if that order is still open.
  if (link.triggeredByOrder && link.triggeredByOrder.type === 'SEKACKA' && link.triggeredByOrder.status === 'OPEN') {
    try {
      await addSekackaParticipant(link.triggeredByOrder.id, linkedUserId, {
        source: 'ADMIN',
        actorUserId: resolverUserId,
      })
    } catch (err) {
      console.error('Failed to auto-add user after resolving pending link:', err)
    }
  }

  return link
}

export async function resolvePendingDiscordLinkToUser(pendingLinkId: string, targetUserId: string) {
  const admin = await requireAdmin()

  const link = await prisma.pendingDiscordLink.findUnique({ where: { id: pendingLinkId } })
  if (!link) return { error: 'Pending link not found' }
  if (link.resolvedAt) return { error: 'Already resolved' }

  const conflict = await prisma.user.findUnique({ where: { discordId: link.discordId } })
  if (conflict && conflict.id !== targetUserId) {
    return { error: 'Discord ID is already linked to another user' }
  }

  await prisma.user.update({
    where: { id: targetUserId },
    data: { discordId: link.discordId },
  })

  await finalizeResolution(pendingLinkId, admin.id, targetUserId)
  return { success: true }
}

export async function resolvePendingDiscordLinkCreateUser(
  pendingLinkId: string,
  data: { username: string; displayName: string; role: 'ADMIN' | 'USER' },
) {
  const admin = await requireAdmin()

  if (!/^[a-zA-Z0-9_]+$/.test(data.username) || data.username.length < 1) {
    return { error: 'Invalid username' }
  }
  if (!data.displayName.trim()) {
    return { error: 'Display name required' }
  }

  const link = await prisma.pendingDiscordLink.findUnique({ where: { id: pendingLinkId } })
  if (!link) return { error: 'Pending link not found' }
  if (link.resolvedAt) return { error: 'Already resolved' }

  const conflict = await prisma.user.findUnique({ where: { discordId: link.discordId } })
  if (conflict) return { error: 'Discord ID is already linked to another user' }

  const usernameTaken = await prisma.user.findUnique({ where: { username: data.username } })
  if (usernameTaken) return { error: 'Username already exists' }

  const tempPassword = randomBytes(8).toString('hex')
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS)

  const created = await prisma.user.create({
    data: {
      username: data.username,
      displayName: data.displayName.trim(),
      role: data.role,
      discordId: link.discordId,
      passwordHash,
      isFirstLogin: true,
    },
  })

  await finalizeResolution(pendingLinkId, admin.id, created.id)
  return { success: true, userId: created.id, tempPassword }
}

export async function dismissPendingDiscordLink(pendingLinkId: string) {
  const admin = await requireAdmin()

  await prisma.pendingDiscordLink.update({
    where: { id: pendingLinkId },
    data: {
      resolvedAt: new Date(),
      resolvedByUserId: admin.id,
    },
  })

  return { success: true }
}

export async function getUsersWithoutDiscordLink() {
  await requireAdmin()

  return prisma.user.findMany({
    where: { discordId: null },
    select: { id: true, displayName: true, username: true },
    orderBy: { displayName: 'asc' },
  })
}
