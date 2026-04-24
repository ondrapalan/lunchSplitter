'use server'

import { revalidateTag } from 'next/cache'
import { auth } from '~/lib/auth'
import { prisma } from '~/lib/prisma'
import { cached, ORDER_TAGS } from '~/lib/cache'

const listUsersCached = cached(
  async () => {
    return prisma.user.findMany({
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        isFirstLogin: true,
        aliases: true,
        bankAccountNumber: true,
        discordId: true,
      },
      orderBy: { createdAt: 'asc' },
    })
  },
  ['users-all'],
  { tags: [ORDER_TAGS.usersAll], revalidate: 300 },
)

const getRegisteredUsersCached = cached(
  async () => {
    return prisma.user.findMany({
      select: {
        id: true,
        displayName: true,
        aliases: true,
      },
      orderBy: { displayName: 'asc' },
    })
  },
  ['users-registered'],
  { tags: [ORDER_TAGS.users], revalidate: 300 },
)

function invalidateUsers() {
  revalidateTag(ORDER_TAGS.users)
  revalidateTag(ORDER_TAGS.usersAll)
}

export async function listUsers() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    throw new Error('Unauthorized')
  }
  return listUsersCached()
}

export async function deleteUser(userId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    throw new Error('Unauthorized')
  }

  if (userId === session.user.id) {
    throw new Error('Cannot delete yourself')
  }

  // Unlink from order participations (set userId to null) so orders aren't affected
  await prisma.orderPerson.updateMany({
    where: { userId },
    data: { userId: null },
  })

  await prisma.user.delete({ where: { id: userId } })

  invalidateUsers()
  return { success: true }
}

export async function updateUserAliases(userId: string, aliases: string[]) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    throw new Error('Unauthorized')
  }

  const trimmed = aliases.map(a => a.trim()).filter(Boolean)

  await prisma.user.update({
    where: { id: userId },
    data: { aliases: trimmed },
  })

  invalidateUsers()
  return { success: true }
}

export async function getRegisteredUsers() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  return getRegisteredUsersCached()
}

export async function setUserDiscordId(userId: string, discordId: string | null) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  const cleaned = discordId?.trim() || null
  if (cleaned !== null && !/^\d{17,20}$/.test(cleaned)) {
    return { error: 'Discord User ID must be 17-20 digits' }
  }

  if (cleaned) {
    const existing = await prisma.user.findUnique({ where: { discordId: cleaned } })
    if (existing && existing.id !== userId) {
      return { error: 'This Discord ID is already linked to another account' }
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { discordId: cleaned },
  })

  invalidateUsers()
  return { success: true }
}
