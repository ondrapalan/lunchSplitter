'use server'

import { auth } from '~/lib/auth'
import { prisma } from '~/lib/prisma'
import { prismaOrderToLunchSession } from '~/lib/mappers'
import { calculatePersonSummaries } from '~/features/lunch/utils/calculations'
import { buildSpdString, czechAccountToIban, generateVariableSymbol } from '~/features/lunch/utils/qrPlatba'
import { sendPaymentDm, isDiscordConfigured } from '~/lib/discord'
import QRCode from 'qrcode'

export async function linkDiscord(discordId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  if (!/^\d{17,20}$/.test(discordId)) {
    return { error: 'Discord User ID must be 17-20 digits' }
  }

  // Check if this Discord ID is already linked to another user
  const existing = await prisma.user.findUnique({ where: { discordId } })
  if (existing && existing.id !== session.user.id) {
    return { error: 'This Discord ID is already linked to another account' }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { discordId },
  })

  return { success: true }
}

export async function unlinkDiscord() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  await prisma.user.update({
    where: { id: session.user.id },
    data: { discordId: null },
  })

  return { success: true }
}

export async function getDiscordId(): Promise<string | null> {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { discordId: true },
  })
  return user?.discordId ?? null
}

const fullOrderInclude = {
  restaurant: true,
  feeAdjustments: { orderBy: { sortOrder: 'asc' as const } },
  people: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      user: { select: { displayName: true, discordId: true } },
      items: {
        orderBy: { sortOrder: 'asc' as const },
        include: {
          sharedWith: true,
          customShares: true,
        },
      },
    },
  },
}

interface NotificationResult {
  sent: string[]
  skipped: string[]
  failed: string[]
}

/**
 * Send QR code DMs to all Discord-linked participants when an order is closed.
 * Returns who was notified, skipped, and failed.
 */
export async function sendOrderQrCodes(orderId: string): Promise<NotificationResult> {
  if (!isDiscordConfigured()) {
    return { sent: [], skipped: [], failed: [] }
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: fullOrderInclude,
  })

  if (!order || order.status !== 'CLOSED' || !order.bankAccountNumber) {
    return { sent: [], skipped: [], failed: [] }
  }

  const lunchSession = prismaOrderToLunchSession(order)
  const summaries = calculatePersonSummaries(lunchSession)
  const creatorPersonId = order.people.find(p => p.userId === order.createdById)?.id

  let iban: string
  try {
    iban = czechAccountToIban(order.bankAccountNumber)
  } catch {
    return { sent: [], skipped: [], failed: [] }
  }

  const result: NotificationResult = { sent: [], skipped: [], failed: [] }
  const orderDate = order.createdAt.toLocaleDateString('cs-CZ')

  for (const person of order.people) {
    const personName = person.user?.displayName ?? person.name

    // Skip creator — they're the one collecting payment
    if (person.id === creatorPersonId) continue

    // Skip people without Discord linked
    if (!person.user?.discordId) {
      result.skipped.push(personName)
      continue
    }

    const summary = summaries.find(s => s.personId === person.id)
    if (!summary || summary.withFees <= 0) continue

    try {
      const variableSymbol = generateVariableSymbol(orderId, person.id)
      const spdString = buildSpdString({
        iban,
        amount: summary.withFees,
        variableSymbol,
        message: order.restaurant.name,
      })

      // Generate QR code as data URL for embedding in Discord
      const qrDataUrl = await QRCode.toDataURL(spdString, {
        width: 200,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      })

      const { messageId } = await sendPaymentDm(person.user.discordId, {
        restaurantName: order.restaurant.name,
        amount: summary.withFees,
        orderPersonId: person.id,
        qrDataUrl,
        orderDate,
      })

      // Store the Discord message ID for tracking
      await prisma.paymentConfirmation.upsert({
        where: { orderPersonId: person.id },
        create: {
          orderPersonId: person.id,
          confirmedVia: 'pending',
          discordMessageId: messageId,
        },
        update: {
          confirmedVia: 'pending',
          discordMessageId: messageId,
        },
      })

      result.sent.push(personName)
    } catch (err) {
      console.error(`Failed to send Discord DM to ${personName}:`, err)
      result.failed.push(personName)
    }
  }

  return result
}

/**
 * Get payment confirmation status for all people in an order.
 */
export async function getPaymentConfirmations(orderId: string): Promise<Record<string, { confirmed: boolean; confirmedAt: string | null }>> {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const confirmations = await prisma.paymentConfirmation.findMany({
    where: {
      orderPerson: { orderId },
    },
    select: {
      orderPersonId: true,
      confirmedVia: true,
      confirmedAt: true,
    },
  })

  const result: Record<string, { confirmed: boolean; confirmedAt: string | null }> = {}
  for (const conf of confirmations) {
    result[conf.orderPersonId] = {
      confirmed: conf.confirmedVia !== 'pending',
      confirmedAt: conf.confirmedVia !== 'pending' ? conf.confirmedAt.toISOString() : null,
    }
  }
  return result
}
