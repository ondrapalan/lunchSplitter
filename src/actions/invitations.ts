'use server'

import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { auth } from '~/lib/auth'
import { prisma } from '~/lib/prisma'
import { registerSchema } from '~/lib/validations'

const MAX_ACTIVE_INVITATIONS = 5
const INVITATION_EXPIRY_DAYS = 7

export async function createInvitation() {
  const session = await auth()
  if (!session?.user) return { error: 'Unauthorized' }

  // Check active invitation limit
  const activeCount = await prisma.invitation.count({
    where: {
      invitedById: session.user.id,
      expiresAt: { gt: new Date() },
      usedAt: null,
    },
  })

  if (activeCount >= MAX_ACTIVE_INVITATIONS) {
    return { error: `You can have at most ${MAX_ACTIVE_INVITATIONS} active invitations` }
  }

  const token = crypto.randomUUID()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS)

  // Opportunistic cleanup: delete expired unused invitations globally
  await prisma.invitation.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
      usedAt: null,
    },
  })

  const invitation = await prisma.invitation.create({
    data: {
      token,
      invitedById: session.user.id,
      expiresAt,
    },
  })

  return { token: invitation.token }
}

export async function getMyInvitations() {
  const session = await auth()
  if (!session?.user) return { error: 'Unauthorized' }

  const invitations = await prisma.invitation.findMany({
    where: { invitedById: session.user.id },
    include: {
      usedBy: { select: { displayName: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return {
    invitations: invitations.map((inv) => ({
      id: inv.id,
      token: inv.token,
      createdAt: inv.createdAt.toISOString(),
      expiresAt: inv.expiresAt.toISOString(),
      usedAt: inv.usedAt?.toISOString() ?? null,
      usedByName: inv.usedBy?.displayName ?? null,
    })),
  }
}

export async function validateInviteToken(token: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
  })

  if (!invitation) return { valid: false, reason: 'Invalid invitation link' } as const
  if (invitation.usedAt) return { valid: false, reason: 'This invitation has already been used' } as const
  if (invitation.expiresAt < new Date()) return { valid: false, reason: 'This invitation has expired' } as const

  return { valid: true } as const
}

export async function registerWithInvite(
  token: string,
  data: { username: string; displayName: string; password: string; confirmPassword: string },
) {
  // Validate form data
  const parsed = registerSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  // Re-validate token
  const invitation = await prisma.invitation.findUnique({
    where: { token },
  })

  if (!invitation || invitation.usedAt || invitation.expiresAt < new Date()) {
    return { error: 'This invitation is no longer valid' }
  }

  // Check username uniqueness
  const existingUser = await prisma.user.findUnique({
    where: { username: parsed.data.username },
  })
  if (existingUser) {
    return { error: 'Username already exists' }
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10)

  try {
    await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          username: parsed.data.username,
          displayName: parsed.data.displayName,
          passwordHash,
          role: 'USER',
          isFirstLogin: false,
        },
      })

      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          usedAt: new Date(),
          usedById: newUser.id,
        },
      })
    })
  } catch {
    return { error: 'Registration failed. Please try again.' }
  }

  return { success: true }
}
