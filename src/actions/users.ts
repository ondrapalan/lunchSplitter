'use server'

import { auth } from '~/lib/auth'
import { prisma } from '~/lib/prisma'

export async function listUsers() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    throw new Error('Unauthorized')
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      isFirstLogin: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  return users
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

  return { success: true }
}

export async function getRegisteredUsers() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const users = await prisma.user.findMany({
    select: {
      id: true,
      displayName: true,
    },
    orderBy: { displayName: 'asc' },
  })

  return users
}
