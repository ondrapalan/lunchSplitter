'use server'

import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { auth } from '~/lib/auth'
import { prisma } from '~/lib/prisma'
import { registerSchema, updateDisplayNameSchema, updateBankAccountSchema } from '~/lib/validations'

const BCRYPT_ROUNDS = 12

export async function hasAnyUsers() {
  const count = await prisma.user.count()
  return count > 0
}

export async function registerFirstAdmin(data: {
  username: string
  displayName: string
  password: string
}) {
  const parsed = registerSchema.safeParse({ ...data, confirmPassword: data.password })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS)

  try {
    // Use transaction to prevent TOCTOU race condition
    await prisma.$transaction(async (tx) => {
      const count = await tx.user.count()
      if (count > 0) {
        throw new Error('Admin already exists')
      }

      await tx.user.create({
        data: {
          username: data.username,
          displayName: data.displayName,
          role: 'ADMIN',
          passwordHash,
          isFirstLogin: false,
        },
      })
    }, { isolationLevel: 'Serializable' })
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    if (message === 'Admin already exists') {
      return { error: 'Admin already exists. Use login instead.' }
    }
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
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS)

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

  const parsed = updateDisplayNameSchema.safeParse({ displayName })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { displayName: parsed.data.displayName },
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

  const parsed = updateBankAccountSchema.safeParse({ bankAccountNumber })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { bankAccountNumber: parsed.data.bankAccountNumber },
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

  const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password too long')
  const parsed = passwordSchema.safeParse(newPassword)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })
  if (!user) throw new Error('User not found')

  const valid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!valid) return { error: 'Current password is incorrect' }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
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

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!user) return { error: 'User not found' }

  const tempPassword = randomBytes(8).toString('hex')
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS)

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, isFirstLogin: true },
  })

  return { tempPassword }
}

export async function setupPassword(password: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password too long')
  const parsed = passwordSchema.safeParse(password)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })
  if (!user || !user.isFirstLogin) throw new Error('Invalid state')

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, isFirstLogin: false },
  })

  return { success: true }
}
