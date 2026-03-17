'use server'

import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { auth } from '~/lib/auth'
import { prisma } from '~/lib/prisma'

export async function hasAnyUsers() {
  const count = await prisma.user.count()
  return count > 0
}

export async function registerFirstAdmin(data: {
  username: string
  displayName: string
  password: string
}) {
  const count = await prisma.user.count()
  if (count > 0) {
    return { error: 'Admin already exists. Use login instead.' }
  }

  const passwordHash = await bcrypt.hash(data.password, 10)

  try {
    await prisma.user.create({
      data: {
        username: data.username,
        displayName: data.displayName,
        role: 'ADMIN',
        passwordHash,
        isFirstLogin: false,
      },
    })
    return { success: true }
  } catch {
    return { error: 'Username already exists' }
  }
}

export async function createUser(data: {
  username: string
  displayName: string
  role: 'ADMIN' | 'USER'
}) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  const tempPassword = randomBytes(8).toString('hex')
  const passwordHash = await bcrypt.hash(tempPassword, 10)

  try {
    await prisma.user.create({
      data: {
        username: data.username,
        displayName: data.displayName,
        role: data.role,
        passwordHash,
        isFirstLogin: true,
      },
    })
    return { tempPassword }
  } catch {
    return { error: 'Username already exists' }
  }
}

export async function updateDisplayName(displayName: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  await prisma.user.update({
    where: { id: session.user.id },
    data: { displayName },
  })

  return { success: true }
}

export async function getDisplayName() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { displayName: true },
  })
  if (!user) throw new Error('User not found')

  return user.displayName
}

export async function updateBankAccount(bankAccountNumber: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  await prisma.user.update({
    where: { id: session.user.id },
    data: { bankAccountNumber },
  })

  return { success: true }
}

export async function getBankAccount() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { bankAccountNumber: true },
  })
  if (!user) throw new Error('User not found')

  return user.bankAccountNumber
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })
  if (!user) throw new Error('User not found')

  const valid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!valid) return { error: 'Current password is incorrect' }

  const passwordHash = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  })

  return { success: true }
}

export async function resetUserPassword(userId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return { error: 'Unauthorized' }
  }

  const tempPassword = randomBytes(8).toString('hex')
  const passwordHash = await bcrypt.hash(tempPassword, 10)

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, isFirstLogin: true },
  })

  return { tempPassword }
}

export async function setupPassword(password: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })
  if (!user || !user.isFirstLogin) throw new Error('Invalid state')

  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, isFirstLogin: false },
  })

  return { success: true }
}
