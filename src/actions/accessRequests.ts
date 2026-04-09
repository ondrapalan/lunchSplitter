'use server'

import bcrypt from 'bcryptjs'
import { auth } from '~/lib/auth'
import { prisma } from '~/lib/prisma'
import { registerSchema } from '~/lib/validations'
import { isDiscordConfigured } from '~/lib/discord'
import { sendAccessRequestDm } from '~/lib/discord'

const BCRYPT_ROUNDS = 12

export async function submitAccessRequest(data: {
  username: string
  displayName: string
  password: string
  confirmPassword: string
}) {
  const parsed = registerSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  // Check if username is already taken (by a user or another pending request)
  const existingUser = await prisma.user.findUnique({ where: { username: parsed.data.username } })
  if (existingUser) {
    return { error: 'Username is already taken' }
  }

  const existingRequest = await prisma.accessRequest.findUnique({ where: { username: parsed.data.username } })
  if (existingRequest) {
    if (existingRequest.status === 'pending') {
      return { error: 'A request with this username is already pending' }
    }
    // Clean up old denied/approved requests for this username
    await prisma.accessRequest.delete({ where: { id: existingRequest.id } })
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, BCRYPT_ROUNDS)

  const request = await prisma.accessRequest.create({
    data: {
      username: parsed.data.username,
      displayName: parsed.data.displayName,
      passwordHash,
    },
  })

  // Notify admins via Discord
  if (isDiscordConfigured()) {
    try {
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', discordId: { not: null } },
        select: { discordId: true },
      })

      for (const admin of admins) {
        if (!admin.discordId) continue
        try {
          const messageId = await sendAccessRequestDm(admin.discordId, {
            requestId: request.id,
            username: request.username,
            displayName: request.displayName,
          })
          // Store the message ID on the request
          await prisma.accessRequest.update({
            where: { id: request.id },
            data: { discordMessageId: messageId },
          })
        } catch (err) {
          console.error('Failed to send access request DM to admin:', err)
        }
      }
    } catch (err) {
      console.error('Failed to notify admins:', err)
    }
  }

  return { success: true }
}

export async function approveAccessRequest(requestId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    throw new Error('Unauthorized')
  }

  const request = await prisma.accessRequest.findUnique({ where: { id: requestId } })
  if (!request || request.status !== 'pending') {
    throw new Error('Request not found or already processed')
  }

  // Check username isn't taken (could have been created while pending)
  const existingUser = await prisma.user.findUnique({ where: { username: request.username } })
  if (existingUser) {
    await prisma.accessRequest.update({ where: { id: requestId }, data: { status: 'denied' } })
    throw new Error('Username was already taken')
  }

  // Create the user and mark request as approved
  await prisma.$transaction([
    prisma.user.create({
      data: {
        username: request.username,
        displayName: request.displayName,
        passwordHash: request.passwordHash,
        isFirstLogin: false,
      },
    }),
    prisma.accessRequest.update({
      where: { id: requestId },
      data: { status: 'approved' },
    }),
  ])

  return { success: true }
}

export async function denyAccessRequest(requestId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    throw new Error('Unauthorized')
  }

  await prisma.accessRequest.update({
    where: { id: requestId },
    data: { status: 'denied' },
  })

  return { success: true }
}
